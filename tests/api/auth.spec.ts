import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const BASE_URL = 'http://localhost:3001';

// ─── LOGIN ────────────────────────────────────────────────────────────────────

test(qase(1, 'TC-AUTH-01 – valid credentials → 200 + JWT returned @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.token).toBeDefined();
  expect(typeof body.token).toBe('string');
});

test(qase(2, 'TC-AUTH-02 – invalid password → 401, no token @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'wrongpassword' },
  });

  expect(res.status()).toBe(401);

  const body = await res.json();
  expect(body.token).toBeUndefined();
});

test(qase(3, 'TC-AUTH-03 – missing password → 422, no token'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com' },
  });

  expect(res.status()).toBe(422);

  const body = await res.json();
  expect(body.token).toBeUndefined();
});

// ─── JWT STRUCTURE ────────────────────────────────────────────────────────────

test(qase(4, 'TC-AUTH-04 – JWT has 3 parts: header.payload.signature @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });

  const { token } = await res.json();

  expect(token.split('.')).toHaveLength(3);
});

// ─── PROTECTED ENDPOINT ───────────────────────────────────────────────────────

test(qase(5, 'TC-AUTH-05 – valid token → protected endpoint returns 200 @smoke @prod-smoke'), async ({ request }) => {
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });
  const { token } = await loginRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
});

test(qase(6, 'TC-AUTH-06 – no token → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/account/balance`);
  expect(res.status()).toBe(401);
});

test(qase(7, 'TC-AUTH-07 – invalid token → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });

  expect(res.status()).toBe(401);
});

test(qase(8, 'TC-AUTH-08 – expired token → 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(108, 'TC-AUTH-SEC-01 – SQL injection in email field → 401 not 500'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: "' OR '1'='1", password: 'anything' },
  });

  expect(res.status()).toBe(401);
  expect([400, 401, 422]).toContain(res.status());
});

test(qase(109, 'TC-AUTH-SEC-02 – tampered JWT role claim → 401'), async ({ request }) => {
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });
  const { token } = await loginRes.json();

  // Decode payload, change role to admin, re-encode without valid signature
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  payload.role = 'admin';
  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  const res = await request.get(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });

  expect(res.status()).toBe(401);
});
