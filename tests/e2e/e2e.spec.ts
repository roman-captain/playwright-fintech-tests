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

// ─── AUTH FLOWS ───────────────────────────────────────────────────────────────

test(qase(83, 'TC-E2E-01 – login → token → access protected endpoint @smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });
  expect(res.status()).toBe(200);
  const { token } = await res.json();
  expect(token).toBeDefined();

  const protectedRes = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(protectedRes.status()).toBe(200);
});

test(qase(84, 'TC-E2E-02 – expired token → all protected endpoints reject'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const [balance, payments, transactions] = await Promise.all([
    request.get(`${BASE_URL}/api/v1/account/balance`, { headers: { Authorization: `Bearer ${token}` } }),
    request.get(`${BASE_URL}/api/v1/payments/pay-001`, { headers: { Authorization: `Bearer ${token}` } }),
    request.get(`${BASE_URL}/api/v1/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  expect(balance.status()).toBe(401);
  expect(payments.status()).toBe(401);
  expect(transactions.status()).toBe(401);
});

// ─── PAYMENT FLOWS ───────────────────────────────────────────────────────────

test(qase(85, 'TC-E2E-03 – full payment flow: login → initiate → webhook → balance decreased → tx in history @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const balanceBefore = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { balance: balanceStart } = await balanceBefore.json();

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 100, currency: 'EUR', recipient: 'e2e@example.com' },
  });
  expect(payRes.status()).toBe(201);
  const { id: paymentId } = await payRes.json();

  const webhookRes = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: paymentId, status: 'completed', signature: 'valid-sig' },
  });
  expect(webhookRes.status()).toBe(200);

  const balanceAfter = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { balance: balanceEnd } = await balanceAfter.json();
  expect(balanceEnd).toBeLessThan(balanceStart);

  const txRes = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await txRes.json();
  const found = data.find((tx: { id: string }) => tx.id === paymentId);
  expect(found).toBeDefined();
});

test(qase(86, 'TC-E2E-04 – KYC gate: pending user cannot initiate payment @smoke'), async ({ request }) => {
  const token = await getToken(request, 'kyc-pending@test.com');

  const kycRes = await request.get(`${BASE_URL}/api/v1/account/kyc-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { can_transact } = await kycRes.json();
  expect(can_transact).toBe(false);

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });
  expect(payRes.status()).toBe(403);
  const body = await payRes.json();
  expect(body.code).toBe('KYC_PENDING');
});

test(qase(87, 'TC-E2E-05 – insufficient funds: payment blocked, balance unchanged'), async ({ request }) => {
  const token = await getToken(request);

  const balanceBefore = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { balance: balanceStart } = await balanceBefore.json();

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 9000, currency: 'EUR', recipient: 'vendor@example.com' },
  });
  expect(payRes.status()).toBe(422);

  const balanceAfter = await request.get(`${BASE_URL}/api/v1/account/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { balance: balanceEnd } = await balanceAfter.json();
  expect(balanceEnd).toBe(balanceStart);
});

test(qase(88, 'TC-E2E-06 – spending limit exceeded: payment blocked'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 5001, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.code).toBe('LIMIT_EXCEEDED');
});

test(qase(89, 'TC-E2E-07 – idempotency: same key → same payment, no duplicate in history'), async ({ request }) => {
  const token = await getToken(request);
  const key = `e2e-idem-${Date.now()}`;
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

  const txRes = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await txRes.json();
  const matches = data.filter((tx: { idempotency_key: string }) => tx.idempotency_key === key);
  expect(matches.length).toBe(1);
});

// ─── SECURITY FLOWS ───────────────────────────────────────────────────────────

test(qase(90, 'TC-E2E-08 – IDOR: user A cannot access user B payment or transaction'), async ({ request }) => {
  const tokenA = await getToken(request, 'user@test.com');

  const paymentRes = await request.get(`${BASE_URL}/api/v1/payments/pay-b-001`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  expect(paymentRes.status()).toBe(403);

  const txRes = await request.get(`${BASE_URL}/api/v1/transactions/pay-b-001`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  expect(txRes.status()).toBe(403);
});

test(qase(91, 'TC-E2E-09 – regular user cannot access any admin endpoint'), async ({ request }) => {
  const token = await getToken(request);

  const [users, balance, kyc] = await Promise.all([
    request.get(`${BASE_URL}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
    request.get(`${BASE_URL}/api/v1/admin/users/user-abc-123/balance`, { headers: { Authorization: `Bearer ${token}` } }),
    request.get(`${BASE_URL}/api/v1/admin/kyc/queue`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  expect(users.status()).toBe(403);
  expect(balance.status()).toBe(403);
  expect(kyc.status()).toBe(403);
});

// ─── TRANSACTION HISTORY FLOWS ────────────────────────────────────────────────

test(qase(92, 'TC-E2E-10 – payment appears in transaction history after initiation'), async ({ request }) => {
  const token = await getToken(request);

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 15, currency: 'EUR', recipient: 'history@example.com' },
  });
  const { id: paymentId } = await payRes.json();

  const txRes = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await txRes.json();
  const found = data.find((tx: { id: string }) => tx.id === paymentId);
  expect(found).toBeDefined();
  expect(found.amount).toBe(15);
});

test(qase(93, 'TC-E2E-11 – filter by status=completed returns only completed transactions'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?status=completed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await res.json();

  expect(data.length).toBeGreaterThan(0);
  for (const tx of data) {
    expect(tx.status).toBe('completed');
  }
});

test(qase(94, 'TC-E2E-12 – CSV export contains all user transactions'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect(res.headers()['content-disposition']).toContain('transactions.csv');

  const text = await res.text();
  expect(text).toContain('id,amount,currency');
  expect(text.split('\n').length).toBeGreaterThan(1);
});

// ─── ADMIN FLOWS ──────────────────────────────────────────────────────────────

test(qase(95, 'TC-E2E-13 – admin login → sees all users in system'), async ({ request }) => {
  const token = await getToken(request, 'admin@test.com', 'Admin123!');

  const res = await request.get(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const { data, total } = await res.json();
  expect(total).toBeGreaterThanOrEqual(4);
  const emails = data.map((u: { email: string }) => u.email);
  expect(emails).toContain('user@test.com');
  expect(emails).toContain('kyc-pending@test.com');
});

test(qase(96, 'TC-E2E-14 – admin views specific user balance'), async ({ request }) => {
  const token = await getToken(request, 'admin@test.com', 'Admin123!');

  const res = await request.get(`${BASE_URL}/api/v1/admin/users/user-abc-123/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.userId).toBe('user-abc-123');
  expect(typeof body.balance).toBe('number');
});

test(qase(97, 'TC-E2E-15 – admin sees KYC pending queue with pending users only'), async ({ request }) => {
  const token = await getToken(request, 'admin@test.com', 'Admin123!');

  const res = await request.get(`${BASE_URL}/api/v1/admin/kyc/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const { data, total } = await res.json();
  expect(total).toBeGreaterThanOrEqual(1);
  for (const user of data) {
    expect(user.kyc_status).toBe('pending');
  }
  const emails = data.map((u: { email: string }) => u.email);
  expect(emails).toContain('kyc-pending@test.com');
});
