import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const BASE_URL = 'http://localhost:3001';

async function getToken(request: APIRequestContext, email = 'user@test.com', password = 'Pass123!') {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const { token } = await res.json();
  return token as string;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────

test(qase(19, 'TC-REG-01 – register: valid data → 201 + userId + kyc_status pending @smoke @prod-smoke'), async ({ request }) => {
  const email = `newuser-${Date.now()}@test.com`;

  const res = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password: 'NewPass123!' },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.userId).toBeDefined();
  expect(body.email).toBe(email);
  expect(body.kyc_status).toBe('pending');
});

test(qase(20, 'TC-REG-02 – register: duplicate email → 409'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });

  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toContain('already registered');
});

test(qase(21, 'TC-REG-03 – register: missing email → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { password: 'Pass123!' },
  });

  expect(res.status()).toBe(422);
});

test(qase(22, 'TC-REG-04 – register: missing password → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email: `newuser-${Date.now()}@test.com` },
  });

  expect(res.status()).toBe(422);
});

test(qase(23, 'TC-REG-05 – register: password too short → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email: `newuser-${Date.now()}@test.com`, password: 'short' },
  });

  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.error).toContain('8 characters');
});

test(qase(24, 'TC-REG-06 – registered user can login immediately'), async ({ request }) => {
  const email = `logintest-${Date.now()}@test.com`;
  const password = 'ValidPass123!';

  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password },
  });

  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });

  expect(loginRes.status()).toBe(200);
  const body = await loginRes.json();
  expect(body.token).toBeDefined();
});

test(qase(25, 'TC-REG-07 – newly registered user has KYC pending and cannot pay'), async ({ request }) => {
  const email = `kyctest-${Date.now()}@test.com`;

  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password: 'ValidPass123!' },
  });

  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password: 'ValidPass123!' },
  });
  const { token } = await loginRes.json();

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(payRes.status()).toBe(403);
  const body = await payRes.json();
  expect(body.code).toBe('KYC_PENDING');
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

test(qase(26, 'TC-LOGOUT-01 – logout: valid token → 200 @smoke @prod-smoke'), async ({ request }) => {
  const email = `logout01-${Date.now()}@test.com`;
  await request.post(`${BASE_URL}/api/v1/auth/register`, { data: { email, password: 'ValidPass123!' } });
  const token = await getToken(request, email, 'ValidPass123!');

  const res = await request.post(`${BASE_URL}/api/v1/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.message).toContain('Logged out');
});

test(qase(27, 'TC-LOGOUT-02 – after logout token is invalidated → 401'), async ({ request }) => {
  const email = `logout02-${Date.now()}@test.com`;
  await request.post(`${BASE_URL}/api/v1/auth/register`, { data: { email, password: 'ValidPass123!' } });
  const token = await getToken(request, email, 'ValidPass123!');

  await request.post(`${BASE_URL}/api/v1/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(28, 'TC-LOGOUT-03 – logout without token → 401'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/logout`);
  expect(res.status()).toBe(401);
});

test(qase(29, 'TC-LOGOUT-04 – logout twice with same token → second call returns 401'), async ({ request }) => {
  const email = `logouttest-${Date.now()}@test.com`;
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password: 'ValidPass123!' },
  });
  const token = await getToken(request, email, 'ValidPass123!');

  const first = await request.post(`${BASE_URL}/api/v1/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(first.status()).toBe(200);

  const second = await request.post(`${BASE_URL}/api/v1/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(second.status()).toBe(401);
});
