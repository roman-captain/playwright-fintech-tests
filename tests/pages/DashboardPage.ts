import { type Page, type Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  readonly balanceCard: Locator;
  readonly balanceAmount: Locator;
  readonly balanceCurrency: Locator;
  readonly spendingLimit: Locator;
  readonly kycCard: Locator;
  readonly kycStatus: Locator;
  readonly makePaymentBtn: Locator;
  readonly navDashboard: Locator;
  readonly navPayment: Locator;
  readonly navHistory: Locator;
  readonly navLogout: Locator;

  constructor(page: Page) {
    this.page           = page;
    this.balanceCard    = page.getByTestId('balance-card');
    this.balanceAmount  = page.getByTestId('balance-amount');
    this.balanceCurrency = page.getByTestId('balance-currency');
    this.spendingLimit  = page.getByTestId('spending-limit');
    this.kycCard        = page.getByTestId('kyc-card');
    this.kycStatus      = page.getByTestId('kyc-status');
    this.makePaymentBtn = page.getByTestId('make-payment-btn');
    this.navDashboard   = page.getByTestId('nav-dashboard');
    this.navPayment     = page.getByTestId('nav-payment');
    this.navHistory     = page.getByTestId('nav-history');
    this.navLogout      = page.getByTestId('nav-logout');
  }

  async goto() {
    await this.page.goto('/dashboard.html');
  }

  async logout() {
    await this.navLogout.click();
  }

  async goToPayment() {
    await this.makePaymentBtn.click();
  }

  async goToHistory() {
    await this.navHistory.click();
  }
}
