import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const BASE_URL = 'http://localhost:3001';

// ─── TC-AUTH-09: LEGACY localStorage FLOW ────────────────────────────────────

test(qase(9, 'TC-AUTH-09 – UI login stores JWT in localStorage'), async ({ page }) => {
  await page.goto(BASE_URL);

  await page.fill('[name=email]', 'user@test.com');
  await page.fill('[name=password]', 'Pass123!');
  await page.click('[type=submit]');

  await expect(page).toHaveURL('/dashboard.html');

  const token = await page.evaluate(() => localStorage.getItem('token'));

  expect(token).not.toBeNull();
  expect(token!.split('.')).toHaveLength(3);
});

// ─── TC-AUTH-10: SECURITY UPGRADE - httpOnly COOKIE ──────────────────────────

test(qase(10, 'TC-AUTH-10 – secure login sets httpOnly cookie'), async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login-secure`, {
    data: { email: 'user@test.com', password: 'Pass123!' },
  });

  expect(res.status()).toBe(200);

  const setCookie = res.headers()['set-cookie'];
  expect(setCookie).toBeDefined();
  expect(setCookie.toLowerCase()).toContain('httponly');
  expect(setCookie.toLowerCase()).toContain('samesite=strict');
});
