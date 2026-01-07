/**
 * Reports/Dashboard Page Object Model
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ReportsPage extends BasePage {
  // Locators
  private readonly dashboardCards = this.page.locator('.dashboard-card, ion-card.metric-card');
  private readonly progressChart = this.page.locator('canvas.chart, [data-testid="progress-chart"]');
  private readonly dateRangeSelect = this.page.locator('ion-datetime-button, [data-testid="date-range"]');
  private readonly exportButton = this.page.locator('ion-button:has-text("Export"), ion-button:has-text("내보내기")');
  private readonly refreshButton = this.page.locator('ion-button[aria-label="refresh"]');
  private readonly filterDropdown = this.page.locator('ion-select[name="reportFilter"]');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports');
    await this.waitForLoad();
  }

  /**
   * Go to specific report page
   */
  async gotoReport(reportType: 'progress' | 'customer' | 'waste' | 'unreturned'): Promise<void> {
    await this.page.goto(`/reports/${reportType}`);
    await this.waitForLoad();
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<Map<string, string>> {
    const metrics = new Map<string, string>();
    const cards = this.dashboardCards;
    for (let i = 0; i < (await cards.count()); i++) {
      const card = cards.nth(i);
      const title = (await card.locator('.metric-title, ion-card-title').textContent()) || '';
      const value = (await card.locator('.metric-value, ion-card-content').textContent()) || '';
      metrics.set(title.trim(), value.trim());
    }
    return metrics;
  }

  /**
   * Select date range
   */
  async selectDateRange(startDate: string, endDate: string): Promise<void> {
    await this.dateRangeSelect.click();
    // Handle date picker interaction
    await this.page.locator(`[data-date="${startDate}"]`).click();
    await this.page.locator(`[data-date="${endDate}"]`).click();
    await this.page.locator('ion-button:has-text("Done"), ion-button:has-text("확인")').click();
    await this.waitForLoadingComplete();
  }

  /**
   * Export report
   */
  async exportReport(format: 'csv' | 'pdf' | 'excel'): Promise<void> {
    await this.exportButton.click();
    await this.page.locator(`ion-item:has-text("${format.toUpperCase()}")`).click();
    await this.waitForLoadingComplete();
  }

  /**
   * Refresh dashboard data
   */
  async refresh(): Promise<void> {
    await this.refreshButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Filter reports
   */
  async filterBy(filterValue: string): Promise<void> {
    await this.filterDropdown.click();
    await this.page.locator(`ion-select-option:has-text("${filterValue}")`).click();
    await this.waitForLoadingComplete();
  }

  /**
   * Check if chart is rendered
   */
  async isChartVisible(): Promise<boolean> {
    return this.progressChart.isVisible();
  }

  /**
   * Get metric value by name
   */
  async getMetricValue(metricName: string): Promise<string> {
    const card = this.page.locator(`.dashboard-card:has-text("${metricName}"), ion-card:has-text("${metricName}")`);
    const value = card.locator('.metric-value, .value');
    return (await value.textContent()) || '';
  }

  /**
   * Click on metric card for drill-down
   */
  async drillDown(metricName: string): Promise<void> {
    const card = this.page.locator(`.dashboard-card:has-text("${metricName}"), ion-card:has-text("${metricName}")`);
    await card.click();
    await this.waitForLoad();
  }

  /**
   * Search customer history
   */
  async searchCustomerHistory(customerPhone: string): Promise<void> {
    await this.page.locator('ion-searchbar input, input[name="customerSearch"]').fill(customerPhone);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingComplete();
  }

  /**
   * Get table row count
   */
  async getTableRowCount(): Promise<number> {
    const rows = this.page.locator('table tbody tr, ion-item.data-row');
    return rows.count();
  }
}
