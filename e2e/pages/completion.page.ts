/**
 * Completion Page Object Model
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CompletionPage extends BasePage {
  // Locators
  private readonly completionForm = this.page.locator('form.completion-form, [data-testid="completion-form"]');
  private readonly serialInput = this.page.locator('ion-input[name="serialNumber"], input[name="serialNumber"]');
  private readonly scanButton = this.page.locator('ion-button:has-text("Scan"), ion-button[aria-label="scan"]');
  private readonly wasteCodeSelect = this.page.locator('ion-select[name="wasteCode"]');
  private readonly quantityInput = this.page.locator('ion-input[name="quantity"], input[name="quantity"]');
  private readonly signatureCanvas = this.page.locator('canvas.signature-pad, [data-testid="signature-canvas"]');
  private readonly completeButton = this.page.locator('ion-button:has-text("Complete"), ion-button:has-text("완료")');
  private readonly photoUpload = this.page.locator('input[type="file"], ion-button:has-text("Photo")');
  private readonly certificatePreview = this.page.locator('.certificate-preview, [data-testid="certificate"]');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/completion');
    await this.waitForLoad();
  }

  /**
   * Go to completion page for specific order
   */
  async gotoOrder(orderId: string): Promise<void> {
    await this.page.goto(`/completion/${orderId}`);
    await this.waitForLoad();
  }

  /**
   * Enter serial number
   */
  async enterSerialNumber(serial: string): Promise<void> {
    await this.serialInput.fill(serial);
  }

  /**
   * Click scan button to open barcode scanner
   */
  async openBarcodeScanner(): Promise<void> {
    await this.scanButton.click();
  }

  /**
   * Select waste code
   */
  async selectWasteCode(code: string): Promise<void> {
    await this.wasteCodeSelect.click();
    await this.page.locator(`ion-select-option[value="${code}"], ion-select-option:has-text("${code}")`).click();
  }

  /**
   * Enter waste quantity
   */
  async enterQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(quantity.toString());
  }

  /**
   * Add waste item
   */
  async addWasteItem(code: string, quantity: number): Promise<void> {
    await this.selectWasteCode(code);
    await this.enterQuantity(quantity);
    await this.page.locator('ion-button:has-text("Add"), ion-button:has-text("추가")').click();
  }

  /**
   * Draw signature on canvas
   */
  async drawSignature(): Promise<void> {
    const canvas = this.signatureCanvas;
    const box = await canvas.boundingBox();
    if (box) {
      // Draw a simple signature
      await this.page.mouse.move(box.x + 20, box.y + 20);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 100, box.y + 40);
      await this.page.mouse.move(box.x + 50, box.y + 60);
      await this.page.mouse.up();
    }
  }

  /**
   * Upload photo
   */
  async uploadPhoto(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Click complete button
   */
  async clickComplete(): Promise<void> {
    await this.completeButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Complete order flow
   */
  async completeOrder(serialNumber: string, signature = true): Promise<void> {
    await this.enterSerialNumber(serialNumber);
    if (signature) {
      await this.drawSignature();
    }
    await this.clickComplete();
  }

  /**
   * Check if certificate is visible
   */
  async isCertificateVisible(): Promise<boolean> {
    return this.certificatePreview.isVisible();
  }

  /**
   * Download certificate
   */
  async downloadCertificate(): Promise<void> {
    await this.page.locator('ion-button:has-text("Download"), ion-button:has-text("다운로드")').click();
  }

  /**
   * Get added waste items count
   */
  async getWasteItemCount(): Promise<number> {
    const items = this.page.locator('.waste-item, [data-testid="waste-item"]');
    return items.count();
  }

  /**
   * Check if complete button is enabled
   */
  async isCompleteButtonEnabled(): Promise<boolean> {
    return !(await this.completeButton.isDisabled());
  }
}
