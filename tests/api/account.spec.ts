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

// ─── SMOKE ────────────────────────────────────────────────────────────────────

test(qase(98, 'TC-ACC-S-01 – get balance: valid token → 200 @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.balance).toBeDefined();
  expect(body.currency).toBe('EUR');
});

test(qase(99, 'TC-ACC-S-02 – get balance: no auth → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/account/balance`);
  expect(res.status()).toBe(401);
});

test(qase(100, 'TC-ACC-S-03 – KYC status: approved user → can_transact: true @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/account/kyc-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.kyc_status).toBe('approved');
  expect(body.can_transact).toBe(true);
});

test(qase(101, 'TC-ACC-S-04 – KYC status: pending user → can_transact: false @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request, 'kyc-pending@test.com');

  const res = await request.get(`${BASE_URL}/api/v1/account/kyc-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.kyc_status).toBe('pending');
  expect(body.can_transact).toBe(false);
});

// ─── REGRESSION ───────────────────────────────────────────────────────────────

test(qase(102, 'TC-ACC-R-01 – balance response schema: userId, balance, currency, spending_limit'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  expect(body).toHaveProperty('userId');
  expect(body).toHaveProperty('balance');
  expect(body).toHaveProperty('currency');
  expect(body).toHaveProperty('spending_limit');
});

test(qase(103, 'TC-ACC-R-02 – balance: expired token → 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(104, 'TC-ACC-R-03 – kyc-status schema: userId, kyc_status, can_transact'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/account/kyc-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  expect(body).toHaveProperty('userId');
  expect(body).toHaveProperty('kyc_status');
  expect(body).toHaveProperty('can_transact');
});

test(qase(105, 'TC-ACC-R-04 – kyc-status: no auth → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/account/kyc-status`);
  expect(res.status()).toBe(401);
});
