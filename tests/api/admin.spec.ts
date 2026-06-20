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

async function getAdminToken(request: APIRequestContext) {
  return getToken(request, 'admin@test.com', 'Admin123!');
}

// ─── SMOKE ────────────────────────────────────────────────────────────────────

test(qase(85, 'TC-ADM-S-01 – admin login → 200 + role: admin @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'admin@test.com', password: 'Admin123!' },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.token).toBeDefined();

  const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64').toString());
  expect(payload.role).toBe('admin');
});

test(qase(86, 'TC-ADM-S-02 – admin view user balance → 200 @smoke @prod-smoke'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users/user-abc-123/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.balance).toBeDefined();
  expect(body.currency).toBe('EUR');
});

test(qase(87, 'TC-ADM-S-03 – regular user → admin endpoint → 403 @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(403);
});

test(qase(88, 'TC-ADM-S-04 – admin KYC queue loads → 200 @smoke @prod-smoke'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/kyc/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.total).toBeGreaterThanOrEqual(1);
});

// ─── REGRESSION ───────────────────────────────────────────────────────────────

test(qase(89, 'TC-ADM-R-01 – admin users list → 200 + all users returned'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.total).toBeGreaterThanOrEqual(4);
});

test(qase(90, 'TC-ADM-R-02 – admin users list: no auth → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/admin/users`);
  expect(res.status()).toBe(401);
});

test(qase(91, 'TC-ADM-R-03 – admin view balance: user not found → 404'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users/nonexistent-id/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);
});

test(qase(92, 'TC-ADM-R-04 – admin view balance: no auth → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/admin/users/user-abc-123/balance`);
  expect(res.status()).toBe(401);
});

test(qase(93, 'TC-ADM-R-05 – KYC queue contains only pending users'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/kyc/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  for (const user of body.data) {
    expect(user.kyc_status).toBe('pending');
  }
});

test(qase(94, 'TC-ADM-R-06 – KYC queue: no auth → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/admin/kyc/queue`);
  expect(res.status()).toBe(401);
});

test(qase(95, 'TC-ADM-R-07 – user list response does not expose passwords'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  for (const user of body.data) {
    expect(user).not.toHaveProperty('password');
  }
});

test(qase(96, 'TC-ADM-R-08 – admin cannot initiate payment (not their role)'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(403);
});

test(qase(97, 'TC-ADM-R-09 – admin user balance shows correct userId'), async ({ request }) => {
  const token = await getAdminToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/admin/users/user-kyc-456/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.userId).toBe('user-kyc-456');
  expect(body.spending_limit).toBe(0);
});
