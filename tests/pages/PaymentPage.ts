import { type Page, type Locator } from '@playwright/test';

export class PaymentPage {
  readonly page: Page;

  readonly form: Locator;
  readonly amountInput: Locator;
  readonly currencySelect: Locator;
  readonly recipientInput: Locator;
  readonly submitButton: Locator;
  readonly successBlock: Locator;
  readonly paymentId: Locator;
  readonly paymentStatus: Locator;
  readonly errorMessage: Locator;
  readonly navHistory: Locator;

  constructor(page: Page) {
    this.page           = page;
    this.form           = page.getByTestId('payment-form');
    this.amountInput    = page.getByTestId('amount-input');
    this.currencySelect = page.getByTestId('currency-select');
    this.recipientInput = page.getByTestId('recipient-input');
    this.submitButton   = page.getByTestId('submit-payment-btn');
    this.successBlock   = page.getByTestId('payment-success');
    this.paymentId      = page.getByTestId('payment-id');
    this.paymentStatus  = page.getByTestId('payment-status');
    this.errorMessage   = page.getByTestId('payment-error');
    this.navHistory     = page.getByTestId('nav-history');
  }

  async goto() {
    await this.page.goto('/payment.html');
  }

  async initiatePayment(amount: string, recipient: string, currency = 'EUR') {
    await this.amountInput.fill(amount);
    await this.currencySelect.selectOption(currency);
    await this.recipientInput.fill(recipient);
    await this.submitButton.click();
  }
}
