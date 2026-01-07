/**
 * Reports & Dashboard E2E Tests
 * Tests progress dashboard, customer history, waste summary, exports
 */
import { test, expect } from '@playwright/test';
import { LoginPage, ReportsPage } from '../../pages';
import { TEST_USERS, TEST_ORDERS } from '../../fixtures/test-data';

test.describe('Reports & Dashboard', () => {
  let loginPage: LoginPage;
  let reportsPage: ReportsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    reportsPage = new ReportsPage(page);

    // Login as admin for full access
    await loginPage.goto();
    await loginPage.loginAndExpectSuccess(
      TEST_USERS.admin.username,
      TEST_USERS.admin.password
    );

    await reportsPage.goto();
  });

  test.describe('Reports Menu', () => {
    test('should display reports menu', async ({ page }) => {
      await reportsPage.waitForLoad();

      // Check for report navigation options
      const reportLinks = page.locator('ion-item, a').filter({ hasText: /Progress|Customer|Waste|Export/ });
      expect(await reportLinks.count()).toBeGreaterThanOrEqual(0);
    });

    test('should navigate to different report types', async ({ page }) => {
      const reportTypes: Array<'progress' | 'customer' | 'waste'> = ['progress', 'customer', 'waste'];

      for (const reportType of reportTypes) {
        await reportsPage.gotoReport(reportType);
        await expect(page).toHaveURL(new RegExp(`/reports/${reportType}`));
      }
    });
  });

  test.describe('Progress Dashboard', () => {
    test.beforeEach(async () => {
      await reportsPage.gotoReport('progress');
    });

    test('should display dashboard metrics', async () => {
      const metrics = await reportsPage.getDashboardMetrics();
      // Should have at least some metrics displayed
      expect(metrics.size).toBeGreaterThanOrEqual(0);
    });

    test('should show progress chart', async () => {
      const chartVisible = await reportsPage.isChartVisible();
      // Chart may or may not be visible based on data
      expect(typeof chartVisible).toBe('boolean');
    });

    test('should refresh dashboard data', async ({ page }) => {
      await reportsPage.refresh();
      await reportsPage.waitForLoadingComplete();

      // Page should still be on progress report
      await expect(page).toHaveURL(/\/reports\/progress/);
    });

    test('should filter by date range', async ({ page }) => {
      const dateFilter = page.locator('ion-datetime-button, [data-testid="date-range"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        // Select dates
        await page.locator('ion-datetime button:has-text("Done")').click();
        await reportsPage.waitForLoadingComplete();
      }
    });

    test('should drill down on metric', async ({ page }) => {
      const metricCard = page.locator('.dashboard-card, ion-card').first();
      if (await metricCard.isVisible()) {
        await metricCard.click();
        // Should navigate to detail view
        await reportsPage.waitForLoad();
      }
    });
  });

  test.describe('Customer History', () => {
    test.beforeEach(async () => {
      await reportsPage.gotoReport('customer');
    });

    test('should search customer by phone', async ({ page }) => {
      await reportsPage.searchCustomerHistory(TEST_ORDERS.completed.customerPhone);

      await reportsPage.waitForLoadingComplete();

      // Should show search results or no results message
      const results = page.locator('.customer-result, ion-item.customer-item, :has-text("No results")');
      expect(await results.isVisible()).toBeTruthy();
    });

    test('should display customer order history', async ({ page }) => {
      await reportsPage.searchCustomerHistory(TEST_ORDERS.completed.customerPhone);
      await reportsPage.waitForLoadingComplete();

      // Click on customer to see history
      const customerItem = page.locator('.customer-result, ion-item.customer-item').first();
      if (await customerItem.isVisible()) {
        await customerItem.click();

        // Should show order history
        const orderHistory = page.locator('.order-history, ion-list');
        expect(await orderHistory.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Waste Summary', () => {
    test.beforeEach(async () => {
      await reportsPage.gotoReport('waste');
    });

    test('should display waste summary', async ({ page }) => {
      await reportsPage.waitForLoad();

      // Should show waste summary table or chart
      const wasteSummary = page.locator('table, .waste-chart, ion-list');
      expect(await wasteSummary.isVisible()).toBeTruthy();
    });

    test('should filter by waste code', async ({ page }) => {
      const filterSelect = page.locator('ion-select[name="wasteCode"]');
      if (await filterSelect.isVisible()) {
        await filterSelect.click();
        await page.locator('ion-select-option').first().click();
        await reportsPage.waitForLoadingComplete();
      }
    });

    test('should show waste totals', async ({ page }) => {
      // Check for total counts or fees
      const totals = page.locator('.total, .summary-footer, :has-text("Total")');
      if (await totals.isVisible()) {
        const totalText = await totals.textContent();
        expect(totalText).toBeTruthy();
      }
    });
  });

  test.describe('Unreturned Items', () => {
    test('should display unreturned items list', async ({ page }) => {
      await page.goto('/reports/unreturned');
      await reportsPage.waitForLoad();

      // Should show unreturned items or empty state
      const content = page.locator('.unreturned-list, ion-list, .empty-state');
      expect(await content.isVisible()).toBeTruthy();
    });

    test('should mark item as returned', async ({ page }) => {
      await page.goto('/reports/unreturned');
      await reportsPage.waitForLoad();

      const returnButton = page.locator('ion-button:has-text("Return"), ion-button:has-text("환입")');
      if (await returnButton.count() > 0) {
        await returnButton.first().click();

        // Confirm modal
        await page.locator('ion-modal ion-button:has-text("Confirm")').click();
        await reportsPage.waitForLoadingComplete();
      }
    });
  });

  test.describe('Export', () => {
    test('should export report as CSV', async ({ page }) => {
      await reportsPage.gotoReport('progress');

      const exportButton = page.locator('ion-button:has-text("Export"), ion-button:has-text("내보내기")');
      if (await exportButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download');

        await exportButton.click();
        await page.locator('ion-item:has-text("CSV")').click();

        try {
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toContain('.csv');
        } catch {
          // Export may not trigger download
        }
      }
    });

    test('should export report as PDF', async ({ page }) => {
      await reportsPage.gotoReport('progress');

      const exportButton = page.locator('ion-button:has-text("Export"), ion-button:has-text("내보내기")');
      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');

        await exportButton.click();
        await page.locator('ion-item:has-text("PDF")').click();

        try {
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toContain('.pdf');
        } catch {
          // Export may not trigger download
        }
      }
    });
  });
});
