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

test(qase(40, 'TC-TRX-S-01 – GET /transactions: valid token → 200 + data array @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body).toHaveProperty('total');
});

test(qase(41, 'TC-TRX-S-02 – GET /transactions: no auth → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/transactions`);
  expect(res.status()).toBe(401);
});

test(qase(42, 'TC-TRX-S-03 – GET /transactions/:id: own transaction → 200 @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/pay-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.id).toBe('pay-001');
});

test(qase(43, 'TC-TRX-S-04 – GET /transactions/:id: no auth → 401 @smoke @prod-smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/transactions/pay-001`);
  expect(res.status()).toBe(401);
});

test(qase(44, 'TC-TRX-S-05 – GET /transactions/export?format=csv → 200 CSV @smoke @prod-smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
});

// ─── REGRESSION ───────────────────────────────────────────────────────────────

test(qase(45, 'TC-TRX-R-01 – response schema: total, limit, offset, data present'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('total');
  expect(body).toHaveProperty('limit');
  expect(body).toHaveProperty('offset');
});

test(qase(46, 'TC-TRX-R-02 – pagination: limit=1 → 1 item returned'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  expect(body.data.length).toBeLessThanOrEqual(1);
  expect(body.limit).toBe(1);
});

test(qase(47, 'TC-TRX-R-03 – pagination: offset skips records'), async ({ request }) => {
  const token = await getToken(request);

  const resAll = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const allBody = await resAll.json();

  const resOffset = await request.get(`${BASE_URL}/api/v1/transactions?offset=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const offsetBody = await resOffset.json();

  if (allBody.total > 1) {
    expect(offsetBody.data.length).toBe(allBody.total - 1);
  }
});

test(qase(48, 'TC-TRX-R-04 – filter by status=completed → only completed returned'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?status=completed`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  for (const tx of body.data) {
    expect(tx.status).toBe('completed');
  }
});

test(qase(49, 'TC-TRX-R-05 – filter by status=pending → only pending returned'), async ({ request }) => {
  const token = await getToken(request);

  // initiate a new payment to get a pending one
  await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: 'filter-test@example.com' },
  });

  const res = await request.get(`${BASE_URL}/api/v1/transactions?status=pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  for (const tx of body.data) {
    expect(tx.status).toBe('pending');
  }
});

test(qase(50, 'TC-TRX-R-06 – filter by currency=EUR → only EUR returned'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?currency=EUR`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  for (const tx of body.data) {
    expect(tx.currency).toBe('EUR');
  }
});

test(qase(51, 'TC-TRX-R-07 – filter by date range: from/to → results within range'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(
    `${BASE_URL}/api/v1/transactions?from=2024-09-01T00:00:00Z&to=2024-09-03T00:00:00Z`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const body = await res.json();
  for (const tx of body.data) {
    expect(tx.created_at >= '2024-09-01T00:00:00Z').toBe(true);
    expect(tx.created_at <= '2024-09-03T00:00:00Z').toBe(true);
  }
});

test(qase(52, 'TC-TRX-R-08 – user sees only own transactions, not others'), async ({ request }) => {
  const tokenA = await getToken(request, 'user@test.com');

  const res = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  const body = await res.json();

  for (const tx of body.data) {
    expect(tx.userId).toBe('user-abc-123');
  }
});

test(qase(53, 'TC-TRX-R-09 – IDOR: user A cannot access user B transaction → 403'), async ({ request }) => {
  const tokenA = await getToken(request, 'user@test.com');

  // pay-b-001 belongs to user-b@test.com
  const res = await request.get(`${BASE_URL}/api/v1/transactions/pay-b-001`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  expect(res.status()).toBe(403);
});

test(qase(54, 'TC-TRX-R-10 – transaction not found → 404'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/nonexistent-tx`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);
});

test(qase(55, 'TC-TRX-R-11 – transaction item schema: required fields present'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/pay-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  expect(body).toHaveProperty('id');
  expect(body).toHaveProperty('amount');
  expect(body).toHaveProperty('currency');
  expect(body).toHaveProperty('recipient');
  expect(body).toHaveProperty('status');
  expect(body).toHaveProperty('created_at');
});

test(qase(56, 'TC-TRX-R-12 – export CSV: Content-Disposition header present'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.headers()['content-disposition']).toContain('transactions.csv');
});

test(qase(57, 'TC-TRX-R-13 – export CSV: body contains header row'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  expect(text).toContain('id,amount,currency');
});

test(qase(58, 'TC-TRX-R-14 – export PDF → 200 application/pdf'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
});

test(qase(59, 'TC-TRX-R-15 – export: missing format → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(422);
});

test(qase(60, 'TC-TRX-R-16 – export: invalid format → 422'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=xlsx`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(422);
});

test(qase(61, 'TC-TRX-R-17 – export: no auth → 401'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`);
  expect(res.status()).toBe(401);
});

test(qase(62, 'TC-TRX-R-18 – expired token → GET /transactions returns 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(63, 'TC-TRX-R-19 – expired token → GET /transactions/:id returns 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/transactions/pay-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(64, 'TC-TRX-R-20 – expired token → export returns 401'), async ({ request }) => {
  const expiredRes = await request.get(`${BASE_URL}/api/v1/test/expired-token`);
  const { token } = await expiredRes.json();

  const res = await request.get(`${BASE_URL}/api/v1/transactions/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(401);
});

test(qase(102, 'TC-TRX-R-21 – offset greater than total → empty data array'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?offset=9999`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(0);
  expect(body.total).toBeGreaterThanOrEqual(0);
});

test(qase(103, 'TC-TRX-R-22 – limit=0 → empty data array'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/transactions?limit=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(0);
});

test(qase(104, 'TC-TRX-R-23 – date range with no matching transactions → empty array'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(
    `${BASE_URL}/api/v1/transactions?from=2030-01-01T00:00:00Z&to=2030-12-31T00:00:00Z`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(0);
});
