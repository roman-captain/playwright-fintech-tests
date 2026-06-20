import { expect } from '@playwright/test';
import { test } from '../fixtures/baseTest';
import { qase } from 'playwright-qase-reporter';

test.describe('Transaction History page', () => {

  test(qase(155, 'UI-16 – transactions table is visible with rows', async ({ historyPage }) => {
    await historyPage.goto();
    await expect(historyPage.table).toBeVisible();
    await expect(historyPage.transactionRows.first()).toBeVisible();
  });

  test(qase(156, 'UI-17 – transaction count is displayed', async ({ historyPage }) => {
    await historyPage.goto();
    await expect(historyPage.transactionCount).toBeVisible();
    await expect(historyPage.transactionCount).toContainText('transactions');
  });

  test(qase(157, 'UI-18 – filter by status=completed shows only completed', async ({ historyPage }) => {
    await historyPage.goto();
    await historyPage.filterByStatus('completed');

    const statuses = historyPage.page.getByTestId('tx-status');
    const count = await statuses.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(statuses.nth(i)).toHaveText('completed');
    }
  });

  test(qase(158, 'UI-19 – transaction row has id, amount, status', async ({ historyPage }) => {
    await historyPage.goto();
    const firstRow = historyPage.transactionRows.first();
    await expect(firstRow.getByTestId('tx-id')).not.toHaveText('');
    await expect(firstRow.getByTestId('tx-amount')).not.toHaveText('');
    await expect(firstRow.getByTestId('tx-status')).not.toHaveText('');
  });

  test(qase(159, 'UI-20 – export CSV button is present', async ({ historyPage }) => {
    await historyPage.goto();
    await expect(historyPage.exportCsvBtn).toBeVisible();
  });

});
