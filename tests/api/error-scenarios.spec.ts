import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const BASE_URL = 'http://localhost:3001';

async function getToken(request: APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });
  const { token } = await res.json();
  return token as string;
}

/**
 * Error scenario tests – simulating infrastructure failures.
 *
 * On a real project these would test:
 * - Payment gateway returning 503 (scheduled maintenance)
 * - KYC service unavailable
 * - Notification service down (non-critical – payment still succeeds)
 *
 * Race condition (concurrent duplicate payments) – requires k6/Artillery.
 * See k6/payment-load.js for load profile. Manual test case: TC-PAY-M-01.
 *
 * DB connection lost – requires real infrastructure fault injection.
 * Manual test case: TC-PAY-M-02.
 */

test(qase(135, 'TC-ERR-01 – payment gateway 503 → API returns 503 to client'), async ({ request }) => {
  const token = await getToken(request);

  await request.post(`${BASE_URL}/api/v1/test/simulate-error`, {
    data: { endpoint: 'payments/initiate', status: 503 },
  });

  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50, currency: 'EUR', recipient: 'vendor@example.com' },
  });

  expect(res.status()).toBe(503);
  const body = await res.json();
  expect(body.code).toBe('SIMULATED');
});

test(qase(136, 'TC-ERR-02 – KYC service 503 → account kyc-status endpoint fails gracefully'), async ({ request }) => {
  const token = await getToken(request);

  await request.post(`${BASE_URL}/api/v1/test/simulate-error`, {
    data: { endpoint: 'account/kyc-status', status: 503 },
  });

  const res = await request.get(`${BASE_URL}/api/v1/account/kyc-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(503);
});

test(qase(137, 'TC-ERR-03 – webhook with unknown payment status → API handles gracefully'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: 'pay-001', status: 'unknown_status', signature: 'valid-sig' },
  });

  expect([200, 422]).toContain(res.status());
});

test(qase(138, 'TC-ERR-04 – payment initiated but webhook never arrives → status stays pending'), async ({ request }) => {
  const token = await getToken(request);

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: 'orphan@example.com' },
  });
  expect(payRes.status()).toBe(201);
  const { id: paymentId } = await payRes.json();

  // No webhook sent – check payment status remains pending
  const statusRes = await request.get(`${BASE_URL}/api/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(statusRes.status()).toBe(200);
  const body = await statusRes.json();
  expect(body.status).toBe('pending');
});

test(qase(139, 'TC-ERR-05 – payment succeeds regardless of notification state'), async ({ request }) => {
  const token = await getToken(request);

  // In microservice architecture, notification service failure is non-critical.
  // Payment core must succeed independently of notification delivery.
  // This test verifies the happy path is not blocked by auxiliary services.
  const res = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: 'resilience@example.com' },
  });

  expect(res.status()).toBe(201);
  // Even if notification service were down, payment response is 201
  // Full resilience test requires Toxiproxy or service mesh fault injection
});

// ─── MANUAL TEST CASES (cannot be automated without infra tooling) ────────────

test.skip('TC-ERR-MANUAL-01 – race condition: concurrent duplicate payment requests (requires k6)', () => {
  /**
   * Scenario: two identical POST /payments/initiate requests sent simultaneously.
   * Expected: idempotency key prevents duplicate – only one payment created.
   * Tooling needed: k6 with concurrent VUs sending same idempotency_key.
   * See: k6/payment-load.js
   */
});

test.skip('TC-ERR-MANUAL-02 – database connection lost mid-transaction (requires chaos engineering)', () => {
  /**
   * Scenario: DB connection dropped after payment deducted from balance
   *           but before payment record created.
   * Expected: transaction rolled back, balance restored, 500 returned.
   * Tooling needed: Toxiproxy or Chaos Monkey to inject network fault.
   */
});
