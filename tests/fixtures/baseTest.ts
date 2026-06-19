import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PaymentPage } from '../pages/PaymentPage';
import { HistoryPage } from '../pages/HistoryPage';

type Fixtures = {
  authToken: string;
  authenticatedPage: Page;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  paymentPage: PaymentPage;
  historyPage: HistoryPage;
};

export const test = base.extend<Fixtures>({
  // JWT token for user@test.com – reused across fixtures
  authToken: async ({ request }, use) => {
    const res = await request.post('/api/v1/auth/login', {
      data: { email: 'user@test.com', password: 'Pass123!' },
    });
    const { token } = await res.json();
    await use(token as string);
  },

  // Browser page with token already set in localStorage
  authenticatedPage: async ({ page, authToken }, use) => {
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), authToken);
    await use(page);
  },

  // Page Objects – initialized with authenticated page
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ authenticatedPage }, use) => {
    await use(new DashboardPage(authenticatedPage));
  },

  paymentPage: async ({ authenticatedPage }, use) => {
    await use(new PaymentPage(authenticatedPage));
  },

  historyPage: async ({ authenticatedPage }, use) => {
    await use(new HistoryPage(authenticatedPage));
  },
});

export { expect } from '@playwright/test';
