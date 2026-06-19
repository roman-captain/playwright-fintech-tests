import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const paymentErrors = new Rate('payment_errors');
const paymentDuration = new Trend('payment_duration', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Load profile: ramp up → sustain → ramp down
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // ramp up to 20 VU
    { duration: '3m', target: 20 },   // sustain 20 VU
    { duration: '1m', target: 0  },   // ramp down
  ],
  thresholds: {
    // SLA: 95th percentile under 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate under 1%
    http_req_failed: ['rate<0.01'],
    // Custom: payment errors under 1%
    payment_errors: ['rate<0.01'],
  },
};

// Runs once per VU before the test
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'user@test.com', password: 'Pass123!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, { 'login OK': (r) => r.status === 200 });

  const token = res.json('token');
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // Scenario 1: GET balance (read-heavy, most frequent)
  const balanceRes = http.get(`${BASE_URL}/api/v1/account/balance`, { headers });
  check(balanceRes, { 'balance 200': (r) => r.status === 200 });

  sleep(0.5);

  // Scenario 2: GET transactions (pagination)
  const txRes = http.get(`${BASE_URL}/api/v1/transactions?limit=20`, { headers });
  check(txRes, { 'transactions 200': (r) => r.status === 200 });

  sleep(0.5);

  // Scenario 3: POST initiate payment (write operation, least frequent)
  const payRes = http.post(
    `${BASE_URL}/api/v1/payments/initiate`,
    JSON.stringify({
      amount: 10,
      currency: 'EUR',
      recipient: `load-test-${__VU}-${__ITER}@example.com`,
    }),
    { headers }
  );

  const payOk = check(payRes, {
    'payment 201': (r) => r.status === 201,
    'payment has id': (r) => r.json('id') !== undefined,
  });

  paymentErrors.add(!payOk);
  paymentDuration.add(payRes.timings.duration);

  sleep(1);
}

export function teardown(data) {
  console.log(`Load test complete. Token used: ${data.token ? 'yes' : 'no'}`);
}
