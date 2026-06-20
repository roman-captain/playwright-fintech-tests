import { expect } from '@playwright/test';
import { test } from '../fixtures/baseTest';
import { qase } from 'playwright-qase-reporter';

test.describe('Dashboard page', () => {

  test(qase(144, 'UI-05 – dashboard shows balance card'), async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.balanceCard).toBeVisible();
    await expect(dashboardPage.balanceAmount).not.toHaveText('–');
    await expect(dashboardPage.balanceCurrency).toHaveText('EUR');
  });

  test(qase(145, 'UI-06 – dashboard shows KYC status approved'), async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.kycCard).toBeVisible();
    await expect(dashboardPage.kycStatus).toHaveText('approved');
  });

  test(qase(146, 'UI-07 – navigation links are present'), async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.navDashboard).toBeVisible();
    await expect(dashboardPage.navPayment).toBeVisible();
    await expect(dashboardPage.navHistory).toBeVisible();
  });

  test(qase(147, 'UI-08 – make payment button navigates to payment page'), async ({ dashboardPage, authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.goToPayment();
    await expect(authenticatedPage).toHaveURL('/payment.html');
  });

  test(qase(148, 'UI-09 – logout clears token and redirects to login'), async ({ dashboardPage, authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.logout();
    await expect(authenticatedPage).toHaveURL('/');
    const token = await authenticatedPage.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test(qase(149, 'UI-10 – unauthenticated user redirected from dashboard to login'), async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL('/');
  });

});
