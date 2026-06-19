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

// ─── NOTIFICATION SERVICE ─────────────────────────────────────────────────────

test(qase(121, 'TC-NOTIF-S-01 – GET /notifications: valid token → 200 + data array @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body).toHaveProperty('total');
});

test(qase(122, 'TC-NOTIF-S-02 – GET /notifications: no auth → 401 @smoke'), async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/v1/notifications`);
  expect(res.status()).toBe(401);
});

test(qase(123, 'TC-NOTIF-S-03 – GET /notifications/unread/count → 200 + count @smoke'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/notifications/unread/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.count).toBe('number');
});

test(qase(124, 'TC-NOTIF-R-01 – notification created after payment webhook completed'), async ({ request }) => {
  const token = await getToken(request);
  const uniqueRecipient = `notif-${Date.now()}@example.com`;

  const payRes = await request.post(`${BASE_URL}/api/v1/payments/initiate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 10, currency: 'EUR', recipient: uniqueRecipient },
  });
  const { id: paymentId } = await payRes.json();

  await request.post(`${BASE_URL}/api/v1/webhooks/payment`, {
    data: { payment_id: paymentId, status: 'completed', signature: 'valid-sig' },
  });

  const listRes = await request.get(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await listRes.json();

  const found = data.find((n: { message: string; type: string }) =>
    n.type === 'payment_completed' && n.message.includes(uniqueRecipient)
  );
  expect(found).toBeDefined();
});

test(qase(125, 'TC-NOTIF-R-02 – notification schema: id, type, message, read, created_at'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  if (body.data.length > 0) {
    const notif = body.data[0];
    expect(notif).toHaveProperty('id');
    expect(notif).toHaveProperty('type');
    expect(notif).toHaveProperty('message');
    expect(notif).toHaveProperty('read');
    expect(notif).toHaveProperty('created_at');
  }
});

test(qase(126, 'TC-NOTIF-R-03 – mark notification as read → read: true'), async ({ request }) => {
  const token = await getToken(request);

  const listRes = await request.get(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await listRes.json();
  const unread = data.find((n: { read: boolean; id: string }) => !n.read);

  if (unread) {
    const res = await request.patch(`${BASE_URL}/api/v1/notifications/${unread.id}/read`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.read).toBe(true);
  }
});

test(qase(127, 'TC-NOTIF-R-04 – mark notification not found → 404'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.patch(`${BASE_URL}/api/v1/notifications/nonexistent-id/read`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status()).toBe(404);
});

test(qase(128, 'TC-NOTIF-R-05 – user sees only own notifications'), async ({ request }) => {
  const token = await getToken(request);

  const res = await request.get(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { data } = await res.json();
  for (const notif of data) {
    expect(notif.userId).toBe('user-abc-123');
  }
});

// ─── KYC WEBHOOK ─────────────────────────────────────────────────────────────

test(qase(129, 'TC-KYC-WH-01 – KYC webhook approved → user can now transact @smoke'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { user_id: 'user-kyc-test', status: 'approved', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.kyc_status).toBe('approved');
});

test(qase(130, 'TC-KYC-WH-02 – KYC webhook: invalid signature → 401'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { user_id: 'user-kyc-456', status: 'approved', signature: 'tampered' },
  });

  expect(res.status()).toBe(401);
});

test(qase(131, 'TC-KYC-WH-03 – KYC webhook: missing fields → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { signature: 'valid-sig' },
  });

  expect(res.status()).toBe(422);
});

test(qase(132, 'TC-KYC-WH-04 – KYC webhook: user not found → 404'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { user_id: 'nonexistent-user', status: 'approved', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(404);
});

test(qase(133, 'TC-KYC-WH-05 – KYC webhook: invalid status → 422'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { user_id: 'user-kyc-456', status: 'unknown', signature: 'valid-sig' },
  });

  expect(res.status()).toBe(422);
});

test(qase(134, 'TC-KYC-WH-06 – after KYC approved notification created for user'), async ({ request }) => {
  const token = await getToken(request, 'kyc-test@test.com');

  const countBefore = await (await request.get(`${BASE_URL}/api/v1/notifications/unread/count`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  await request.post(`${BASE_URL}/api/v1/webhooks/kyc`, {
    data: { user_id: 'user-kyc-test', status: 'approved', signature: 'valid-sig' },
  });

  const countAfter = await (await request.get(`${BASE_URL}/api/v1/notifications/unread/count`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  expect(countAfter.count).toBeGreaterThan(countBefore.count);
});
