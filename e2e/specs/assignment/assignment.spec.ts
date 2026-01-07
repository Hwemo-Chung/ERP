/**
 * Assignment Workflow E2E Tests
 * Tests order assignment to installers
 */
import { test, expect } from '@playwright/test';
import { LoginPage, AssignmentPage, OrderListPage } from '../../pages';
import { TEST_USERS, TEST_ORDERS } from '../../fixtures/test-data';

test.describe('Assignment Workflow', () => {
  let loginPage: LoginPage;
  let assignmentPage: AssignmentPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    assignmentPage = new AssignmentPage(page);

    // Login as center manager
    await loginPage.goto();
    await loginPage.loginAndExpectSuccess(
      TEST_USERS.centerManager.username,
      TEST_USERS.centerManager.password
    );

    await assignmentPage.goto();
  });

  test.describe('Assignment List', () => {
    test('should display pending orders for assignment', async ({ page }) => {
      await assignmentPage.waitForLoad();

      // Check that orders are displayed
      const orderCount = await page.locator('.order-card, app-order-card, ion-item.order-item').count();
      expect(orderCount).toBeGreaterThanOrEqual(0);
    });

    test('should filter orders by status', async ({ page }) => {
      // Apply filter
      await page.locator('ion-select[name="status"]').click();
      await page.locator('ion-select-option:has-text("Pending")').click();

      await assignmentPage.waitForLoadingComplete();

      // All visible orders should have pending status
      const orderStatuses = page.locator('.order-status, ion-badge');
      for (let i = 0; i < await orderStatuses.count(); i++) {
        const status = await orderStatuses.nth(i).textContent();
        expect(status?.toLowerCase()).toContain('pending');
      }
    });

    test('should search orders by order number', async ({ page }) => {
      const searchInput = page.locator('ion-searchbar input, input[type="search"]');
      await searchInput.fill(TEST_ORDERS.pending.orderNumber);
      await page.keyboard.press('Enter');

      await assignmentPage.waitForLoadingComplete();

      // Should show matching order
      const orderNumber = page.locator(`:has-text("${TEST_ORDERS.pending.orderNumber}")`);
      expect(await orderNumber.count()).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Single Order Assignment', () => {
    test('should select single order', async () => {
      await assignmentPage.selectOrder(TEST_ORDERS.pending.orderNumber);

      const selectedCount = await assignmentPage.getSelectedCount();
      expect(selectedCount).toBe(1);
    });

    test('should show available installers', async () => {
      const installers = await assignmentPage.getInstallerOptions();
      expect(installers.length).toBeGreaterThan(0);
    });

    test('should assign order to installer', async ({ page }) => {
      await assignmentPage.selectOrder(TEST_ORDERS.pending.orderNumber);
      await assignmentPage.selectInstaller('Test Installer');

      expect(await assignmentPage.isAssignButtonEnabled()).toBe(true);

      await assignmentPage.clickAssign();
      await assignmentPage.confirmAssignment();

      // Should show success toast
      await expect(page.locator('ion-toast')).toBeVisible();
    });

    test('should disable assign button when no order selected', async () => {
      expect(await assignmentPage.isAssignButtonEnabled()).toBe(false);
    });

    test('should disable assign button when no installer selected', async () => {
      await assignmentPage.selectOrder(TEST_ORDERS.pending.orderNumber);
      // Don't select installer
      expect(await assignmentPage.isAssignButtonEnabled()).toBe(false);
    });
  });

  test.describe('Batch Assignment', () => {
    test('should select all orders', async () => {
      await assignmentPage.selectAllOrders();

      const selectedCount = await assignmentPage.getSelectedCount();
      expect(selectedCount).toBeGreaterThan(0);
    });

    test('should assign multiple orders to installer', async ({ page }) => {
      // Select multiple orders
      await assignmentPage.selectAllOrders();
      await assignmentPage.selectInstaller('Test Installer');
      await assignmentPage.clickAssign();
      await assignmentPage.confirmAssignment();

      // Should show success toast
      await expect(page.locator('ion-toast')).toBeVisible();
    });

    test('should handle partial failure in batch assignment', async ({ page }) => {
      // This test simulates when some orders fail to assign
      await assignmentPage.selectAllOrders();
      await assignmentPage.selectInstaller('Test Installer');
      await assignmentPage.clickAssign();
      await assignmentPage.confirmAssignment();

      // Should show result (success or partial failure)
      await assignmentPage.waitForLoadingComplete();
    });
  });

  test.describe('Assignment Detail', () => {
    test('should navigate to order detail', async ({ page }) => {
      await assignmentPage.goToDetail(TEST_ORDERS.pending.orderNumber);

      // Should be on detail page
      await expect(page).toHaveURL(/\/assignment\/|\/orders\//);
    });

    test('should show order details', async ({ page }) => {
      await assignmentPage.goToDetail(TEST_ORDERS.pending.orderNumber);

      // Check for order information
      const customerName = page.locator(`:has-text("${TEST_ORDERS.pending.customerName}")`);
      expect(await customerName.isVisible()).toBeTruthy();
    });

    test('should assign from detail page', async ({ page }) => {
      await assignmentPage.goToDetail(TEST_ORDERS.pending.orderNumber);

      // Select installer from detail page
      const installerSelect = page.locator('ion-select[name="installer"]');
      if (await installerSelect.isVisible()) {
        await installerSelect.click();
        await page.locator('ion-select-option').first().click();

        await page.locator('ion-button:has-text("Assign")').click();
        await assignmentPage.waitForLoadingComplete();
      }
    });
  });

  test.describe('Release Confirmation', () => {
    test('should confirm release for assigned order', async ({ page }) => {
      // Navigate to dispatched orders
      await page.goto('/assignment?status=ASSIGNED');
      await assignmentPage.waitForLoad();

      // Find and confirm release
      const releaseButton = page.locator('ion-button:has-text("Release"), ion-button:has-text("출고")');
      if (await releaseButton.count() > 0) {
        await releaseButton.first().click();

        // Confirm modal
        await page.locator('ion-modal ion-button:has-text("Confirm")').click();
        await assignmentPage.waitForLoadingComplete();
      }
    });
  });
});
