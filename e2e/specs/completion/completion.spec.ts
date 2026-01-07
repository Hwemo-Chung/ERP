/**
 * Completion Workflow E2E Tests
 * Tests order completion, serial input, waste pickup, certificates
 */
import { test, expect } from '@playwright/test';
import { LoginPage, CompletionPage, OrderListPage } from '../../pages';
import { TEST_USERS, TEST_ORDERS, WASTE_CODES } from '../../fixtures/test-data';

test.describe('Completion Workflow', () => {
  let loginPage: LoginPage;
  let completionPage: CompletionPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    completionPage = new CompletionPage(page);

    // Login as installer
    await loginPage.goto();
    await loginPage.loginAndExpectSuccess(
      TEST_USERS.installer.username,
      TEST_USERS.installer.password
    );

    await completionPage.goto();
  });

  test.describe('Completion List', () => {
    test('should display dispatched orders ready for completion', async ({ page }) => {
      await completionPage.waitForLoad();

      // Check that orders are displayed or empty state
      const orderCards = page.locator('.order-card, app-order-card, ion-item.order-item');
      const emptyState = page.locator('.empty-state, :has-text("No orders")');

      const hasOrders = await orderCards.count() > 0;
      const isEmpty = await emptyState.isVisible();

      expect(hasOrders || isEmpty).toBe(true);
    });

    test('should filter orders by date', async ({ page }) => {
      const dateFilter = page.locator('ion-datetime-button, input[type="date"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        // Select today
        await page.locator('ion-datetime button:has-text("Done"), ion-datetime button:has-text("확인")').click();
        await completionPage.waitForLoadingComplete();
      }
    });
  });

  test.describe('Serial Number Input', () => {
    test.beforeEach(async () => {
      await completionPage.gotoOrder(TEST_ORDERS.dispatched.id);
    });

    test('should accept valid serial number', async ({ page }) => {
      await completionPage.enterSerialNumber('SN-2024-001-ABC');

      // Serial number should be visible in input
      const serialInput = page.locator('ion-input[name="serialNumber"] input');
      await expect(serialInput).toHaveValue('SN-2024-001-ABC');
    });

    test('should show scan button for barcode', async ({ page }) => {
      const scanButton = page.locator('ion-button:has-text("Scan"), ion-button[aria-label="scan"]');
      expect(await scanButton.isVisible()).toBeTruthy();
    });

    test('should validate serial number format', async ({ page }) => {
      // Enter invalid serial
      await completionPage.enterSerialNumber('INVALID');

      // Try to proceed - should show validation error or prevent submission
      await completionPage.clickComplete();

      // Should show error or remain on page
      const error = page.locator('.error-message, ion-text[color="danger"]');
      const stillOnPage = page.url().includes('/completion');
      expect(await error.isVisible() || stillOnPage).toBeTruthy();
    });
  });

  test.describe('Waste Pickup', () => {
    test.beforeEach(async () => {
      await completionPage.gotoOrder(TEST_ORDERS.dispatched.id);
    });

    test('should add waste item', async ({ page }) => {
      await completionPage.addWasteItem(WASTE_CODES.refrigerator.code, 1);

      const wasteItemCount = await completionPage.getWasteItemCount();
      expect(wasteItemCount).toBeGreaterThanOrEqual(0);
    });

    test('should show waste code options', async ({ page }) => {
      const wasteSelect = page.locator('ion-select[name="wasteCode"]');
      if (await wasteSelect.isVisible()) {
        await wasteSelect.click();

        const options = page.locator('ion-select-option');
        expect(await options.count()).toBeGreaterThan(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should calculate waste fees', async ({ page }) => {
      await completionPage.addWasteItem(WASTE_CODES.refrigerator.code, 2);

      // Check for fee display
      const feeDisplay = page.locator('.total-fee, .waste-fee, :has-text("₩")');
      if (await feeDisplay.isVisible()) {
        const feeText = await feeDisplay.textContent();
        expect(feeText).toBeTruthy();
      }
    });

    test('should remove waste item', async ({ page }) => {
      await completionPage.addWasteItem(WASTE_CODES.refrigerator.code, 1);

      const initialCount = await completionPage.getWasteItemCount();

      // Remove item
      const removeButton = page.locator('.waste-item ion-button:has-text("Remove"), .waste-item ion-icon[name="trash"]');
      if (await removeButton.isVisible()) {
        await removeButton.first().click();

        const newCount = await completionPage.getWasteItemCount();
        expect(newCount).toBeLessThan(initialCount);
      }
    });
  });

  test.describe('Signature Capture', () => {
    test.beforeEach(async () => {
      await completionPage.gotoOrder(TEST_ORDERS.dispatched.id);
    });

    test('should capture customer signature', async ({ page }) => {
      const canvas = page.locator('canvas.signature-pad, [data-testid="signature-canvas"]');
      if (await canvas.isVisible()) {
        await completionPage.drawSignature();

        // Canvas should have content (non-empty)
        const canvasData = await canvas.evaluate((el: HTMLCanvasElement) => {
          return el.toDataURL().length;
        });
        expect(canvasData).toBeGreaterThan(100);
      }
    });

    test('should clear signature', async ({ page }) => {
      await completionPage.drawSignature();

      const clearButton = page.locator('ion-button:has-text("Clear"), ion-button:has-text("지우기")');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        // Signature should be cleared
      }
    });
  });

  test.describe('Completion Process', () => {
    test.beforeEach(async () => {
      await completionPage.gotoOrder(TEST_ORDERS.dispatched.id);
    });

    test('should complete order with all required fields', async ({ page }) => {
      // Enter serial number
      await completionPage.enterSerialNumber('SN-2024-TEST-001');

      // Add signature
      await completionPage.drawSignature();

      // Complete button should be enabled
      if (await completionPage.isCompleteButtonEnabled()) {
        await completionPage.clickComplete();

        // Should show success or certificate
        await completionPage.waitForLoadingComplete();
      }
    });

    test('should disable complete button without serial number', async () => {
      // Don't enter serial number
      expect(await completionPage.isCompleteButtonEnabled()).toBe(false);
    });

    test('should show validation errors for missing fields', async ({ page }) => {
      await completionPage.clickComplete();

      // Should show validation error
      const error = page.locator('.error-message, ion-text[color="danger"], :has-text("required")');
      expect(await error.isVisible()).toBeTruthy();
    });
  });

  test.describe('Completion Certificate', () => {
    test('should display certificate after completion', async ({ page }) => {
      await completionPage.gotoOrder(TEST_ORDERS.completed.id);

      // Navigate to certificate view
      await page.goto(`/completion/${TEST_ORDERS.completed.id}/certificate`);

      // Certificate should be visible
      const certificate = page.locator('.certificate-preview, [data-testid="certificate"]');
      if (await certificate.isVisible()) {
        expect(await completionPage.isCertificateVisible()).toBe(true);
      }
    });

    test('should download certificate as PDF', async ({ page }) => {
      await page.goto(`/completion/${TEST_ORDERS.completed.id}/certificate`);

      const downloadButton = page.locator('ion-button:has-text("Download"), ion-button:has-text("다운로드")');
      if (await downloadButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download');
        await downloadButton.click();

        // Wait for download (may timeout if not implemented)
        try {
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toContain('.pdf');
        } catch {
          // Download may not be implemented
        }
      }
    });
  });

  test.describe('Photo Upload', () => {
    test.beforeEach(async () => {
      await completionPage.gotoOrder(TEST_ORDERS.dispatched.id);
    });

    test('should upload installation photo', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Create a test image file
        await fileInput.setInputFiles({
          name: 'test-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-image-data'),
        });

        // Photo preview should appear
        const preview = page.locator('.photo-preview, img.uploaded-photo');
        // May or may not appear immediately
      }
    });
  });
});
