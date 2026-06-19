import { test } from '@playwright/test';

/**
 * Visual Regression Tests – Percy
 *
 * Full implementation: https://github.com/roman-captain/playwright-tests-new
 *
 * Purpose: catch unintended visual changes in UI – layout shifts,
 * colour changes, missing elements – that functional tests miss.
 *
 * How it works on the real project:
 * 1. First run creates baseline screenshots in Percy cloud
 * 2. Subsequent runs compare against baseline
 * 3. Differences flagged for review before merge
 * 4. Runs on schedule (daily) and on pre-release
 *
 * Why separate repo / not in CI here:
 * Percy requires PERCY_TOKEN (paid service) and uploads screenshots to cloud.
 * Full implementation is in playwright-tests-new with Percy SDK integrated.
 *
 * Pages covered (in full implementation):
 * - Login page – form layout, button states
 * - Dashboard – balance card, KYC badge colours (green/yellow)
 * - Payment form – field states, success/error messages
 * - Transaction history – table layout, status badge colours
 */

test.skip('VRT-01 – login page: baseline visual snapshot', async ({ page }) => {
  await page.goto('/');
  // await percySnapshot(page, 'Login Page');
});

test.skip('VRT-02 – dashboard: balance card with approved KYC badge (green)', async ({ page }) => {
  await page.goto('/dashboard.html');
  // await percySnapshot(page, 'Dashboard - KYC Approved');
});

test.skip('VRT-03 – payment form: success state after payment initiated', async ({ page }) => {
  await page.goto('/payment.html');
  // await percySnapshot(page, 'Payment Form - Success State');
});

test.skip('VRT-04 – transaction history: table with completed/pending statuses', async ({ page }) => {
  await page.goto('/history.html');
  // await percySnapshot(page, 'Transaction History');
});
