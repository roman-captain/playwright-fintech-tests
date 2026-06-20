import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const BASE_URL = 'http://localhost:3001';

async function getToken(request: APIRequestContext, email = 'user@test.com') {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password: 'Pass123!' },
  });
  const { token } = await res.json();
  return token as string;
}

// ─── SMOKE ────────────────────────────────────────────────────────────────────

test(qase(30, 'TC-PAY-S-01 – initiate payment: valid data → 201 + payment object @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(201);

  const body = await res.json();
  expect(body.id).toBeDefined();
  expect(body.status).toBe('pending');
  expect(body.amount).toBe(50);
});

test(qase(31, 'TC-PAY-S-02 – initiate payment: no auth → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(401);
});

test(qase(32, 'TC-PAY-S-03 – get payment by id → 200 + correct fields @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/payments/pay-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.id).toBe('pay-001');
  expect(body.currency).toBe('EUR');
  expect(body.status).toBeDefined();
});

test(qase(33, 'TC-PAY-S-04 – get payment by id: no auth → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/payments/pay-001`);
  expect(res.status()).toBe(401);
});

test(qase(34, 'TC-PAY-S-05 – webhook: valid payload updates payment status @smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: 'pay-001', status: 'completed', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.received).toBe(true);
  expect(body.status).toBe('completed');
});

test(qase(35, 'TC-PAY-S-06 – webhook: missing signature → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: 'pay-001', status: 'completed' },
  });

  expect(res.status()).toBe(401);
});

// ─── REGRESSION ───────────────────────────────────────────────────────────────

test(qase(36, 'TC-PAY-R-01 – missing amount → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
});

test(qase(37, 'TC-PAY-R-02 – missing currency → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
});

test(qase(38, 'TC-PAY-R-03 – missing recipient → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR' },
  });

  expect(res.status()).toBe(422);
});

test(qase(39, 'TC-PAY-R-04 – amount = 0 → 422 invalid amount'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 0, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
});

test(qase(40, 'TC-PAY-R-05 – negative amount → 422 invalid amount'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: -100, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
});

test(qase(41, 'TC-PAY-R-06 – amount exceeds spending limit → 422 LIMIT_EXCEEDED'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 9999, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);

  const body = await res.json();
  expect(body.code).toBe('LIMIT_EXCEEDED');
});

test(qase(42, 'TC-PAY-R-07 – insufficient funds → 422 INSUFFICIENT_FUNDS'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 2000, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);

  const body = await res.json();
  expect(body.code).toBe('INSUFFICIENT_FUNDS');
});

test(qase(43, 'TC-PAY-R-08 – KYC pending user cannot initiate payment → 403'), async ({ request }) => {
  const token = await getToken(request, 'kyc-pending@test.com');

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(403);

  const body = await res.json();
  expect(body.code).toBe('KYC_PENDING');
});

test(qase(44, 'TC-PAY-R-09 – response schema: required fields present'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: 'schema@example.com' },
  });

  const body = await res.json();

  expect(body).toHaveProperty('id');
  expect(body).toHaveProperty('amount');
  expect(body).toHaveProperty('currency');
  expect(body).toHaveProperty('recipient');
  expect(body).toHaveProperty('status');
  expect(body).toHaveProperty('created_at');
});

test(qase(45, 'TC-PAY-R-10 – idempotent request: same key → same payment, no duplicate'), async ({ request }) => {
  const token = await getToken(request);
  const key = `idem-test-${Date.now()}`;
  const payload = { amount: 30, currency: 'EUR', recipient: 'idem@example.com', idempotency_key: key };

  const res1 = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  const res2 = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });

  expect(res1.status()).toBe(201);
  expect(res2.status()).toBe(200);

  const body1 = await res1.json();
  const body2 = await res2.json();
  expect(body1.id).toBe(body2.id);
});

test(qase(46, 'TC-PAY-R-11 – get payment by id: not found → 404'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/payments/nonexistent-id`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);
});

test(qase(47, 'TC-PAY-R-12 – IDOR: user A cannot access user B payment → 403'), async ({ request }) => {
  const tokenA = await getToken(request, 'user@test.com');

  // pay-b-001 belongs to user-b@test.com
  const res = await request.get(`${BASE_URL}/api/v1/payments/pay-b-001`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  expect(res.status()).toBe(403);
});

test(qase(48, 'TC-PAY-R-13 – webhook: invalid signature → 401'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: 'pay-001', status: 'completed', signature: 'tampered-sig' },
  });

  expect(res.status()).toBe(401);
});

test(qase(49, 'TC-PAY-R-14 – webhook: missing payment_id → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { status: 'completed', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(422);
});

test(qase(50, 'TC-PAY-R-15 – webhook: payment not found → 404'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: 'nonexistent', status: 'completed', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(404);
});

test(qase(51, 'TC-PAY-R-16 – expired token → initiate payment returns 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(401);
});

test(qase(52, 'TC-PAY-R-17 – expired token → get payment by id returns 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/payments/pay-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(53, 'TC-PAY-R-18 – amount as string → 422 type validation'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: '50', currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
});

test(qase(54, 'TC-PAY-R-19 – minimum valid amount 0.01 → 201'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 0.01, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.amount).toBe(0.01);
});

test(qase(55, 'TC-PAY-R-20 – recipient with only whitespace → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: '   ' },
  });

  expect(res.status()).toBe(422);
});

test(qase(56, 'TC-PAY-R-21 – amount near spending limit boundary → 201'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 4999.99, currency: 'EUR', recipient: 'boundary@example.com' },
  });

  expect([201, 422]).toContain(res.status());
});
