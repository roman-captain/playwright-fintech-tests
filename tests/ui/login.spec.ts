import { expect } from '@playwright/test';
import { test } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { qase } from 'playwright-qase-reporter';

test.describe('Login page', () => {

  test(qase(140, 'UI-01 – login form is visible', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test(qase(141, 'UI-02 – valid login redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@test.com', 'Pass123!');

    await expect(page).toHaveURL('/dashboard.html');
  });

  test(qase(142, 'UI-03 – invalid credentials shows error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@test.com', 'wrongpassword');

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid');
  });

  test(qase(143, 'UI-04 – authenticated user is redirected from login to dashboard', async ({ page, authToken }) => {
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), authToken);
    await page.goto('/');

    await expect(page).toHaveURL('/dashboard.html');
  });

});
