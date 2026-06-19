import { type Page, type Locator } from '@playwright/test';

export class HistoryPage {
  readonly page: Page;

  readonly table: Locator;
  readonly tableBody: Locator;
  readonly transactionRows: Locator;
  readonly transactionCount: Locator;
  readonly statusFilter: Locator;
  readonly applyFilterBtn: Locator;
  readonly exportCsvBtn: Locator;

  constructor(page: Page) {
    this.page             = page;
    this.table            = page.getByTestId('transactions-table');
    this.tableBody        = page.getByTestId('transactions-body');
    this.transactionRows  = page.getByTestId('transaction-row');
    this.transactionCount = page.getByTestId('transactions-count');
    this.statusFilter     = page.getByTestId('status-filter');
    this.applyFilterBtn   = page.getByTestId('apply-filter-btn');
    this.exportCsvBtn     = page.getByTestId('export-csv-btn');
  }

  async goto() {
    await this.page.goto('/history.html');
  }

  async filterByStatus(status: 'completed' | 'pending' | 'failed' | '') {
    await this.statusFilter.selectOption(status);
    await this.applyFilterBtn.click();
    await this.page.waitForTimeout(300);
  }

  async getRowCount() {
    return this.transactionRows.count();
  }
}
