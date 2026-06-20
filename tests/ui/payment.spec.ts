import { expect } from '@playwright/test';
import { test } from '../fixtures/baseTest';
import { qase } from 'playwright-qase-reporter';

test.describe('Payment page', () => {

  test(qase(150, 'UI-11 – payment form is visible', async ({ paymentPage }) => {
    await paymentPage.goto();
    await expect(paymentPage.form).toBeVisible();
    await expect(paymentPage.amountInput).toBeVisible();
    await expect(paymentPage.currencySelect).toBeVisible();
    await expect(paymentPage.recipientInput).toBeVisible();
    await expect(paymentPage.submitButton).toBeVisible();
  });

  test(qase(151, 'UI-12 – valid payment shows success with payment id', async ({ paymentPage }) => {
    await paymentPage.goto();
    await paymentPage.initiatePayment('50', 'vendor@example.com');

    await expect(paymentPage.successBlock).toBeVisible();
    await expect(paymentPage.paymentId).not.toHaveText('');
    await expect(paymentPage.paymentStatus).toHaveText('pending');
  });

  test(qase(152, 'UI-13 – form resets after successful payment', async ({ paymentPage }) => {
    await paymentPage.goto();
    await paymentPage.initiatePayment('25', 'test@example.com');

    await expect(paymentPage.successBlock).toBeVisible();
    await expect(paymentPage.amountInput).toHaveValue('');
    await expect(paymentPage.recipientInput).toHaveValue('');
  });

  test(qase(153, 'UI-14 – KYC pending user sees error on payment attempt', async ({ page, request }) => {
    const res = await request.post('/api/v1/auth/login', {
      data: { email: 'kyc-pending@test.com', password: 'Pass123!' },
    });
    const { token } = await res.json();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);

    const { PaymentPage } = await import('../pages/PaymentPage');
    const paymentPage = new PaymentPage(page);
    await paymentPage.goto();
    await paymentPage.initiatePayment('50', 'vendor@example.com');

    await expect(paymentPage.errorMessage).toBeVisible();
  });

  test(qase(154, 'UI-15 – navigation to history page works', async ({ paymentPage, authenticatedPage }) => {
    await paymentPage.goto();
    await paymentPage.navHistory.click();
    await expect(authenticatedPage).toHaveURL('/history.html');
  });

});
