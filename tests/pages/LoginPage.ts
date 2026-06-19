import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput    = page.getByTestId('email-input');
    this.passwordInput = page.getByTestId('password-input');
    this.submitButton  = page.getByTestId('submit-button');
    this.errorMessage  = page.getByTestId('error-message');
    this.successMessage = page.getByTestId('success-message');
  }

  async goto() {
    await this.page.goto('/');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clearSession() {
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
  }
}
