/**
 * Assignment Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AssignmentPage extends BasePage {
  // Locators
  private readonly orderList = this.page.locator('.order-list, app-order-list');
  private readonly installerSelect = this.page.locator('ion-select[name="installer"]');
  private readonly assignButton = this.page.locator('ion-button:has-text("Assign"), ion-button:has-text("배정")');
  private readonly batchSelectCheckbox = this.page.locator('ion-checkbox.select-all');
  private readonly selectedCount = this.page.locator('.selected-count, [data-testid="selected-count"]');
  private readonly confirmModal = this.page.locator('ion-modal.assignment-confirm');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/assignment');
    await this.waitForLoad();
  }

  /**
   * Select an order for assignment
   */
  async selectOrder(orderNumber: string): Promise<void> {
    const orderCheckbox = this.page.locator(
      `[data-order-number="${orderNumber}"] ion-checkbox, :has-text("${orderNumber}") ion-checkbox`
    );
    await orderCheckbox.click();
  }

  /**
   * Select multiple orders
   */
  async selectOrders(orderNumbers: string[]): Promise<void> {
    for (const orderNumber of orderNumbers) {
      await this.selectOrder(orderNumber);
    }
  }

  /**
   * Select all orders
   */
  async selectAllOrders(): Promise<void> {
    await this.batchSelectCheckbox.click();
  }

  /**
   * Select installer from dropdown
   */
  async selectInstaller(installerName: string): Promise<void> {
    await this.installerSelect.click();
    await this.page.locator(`ion-select-option:has-text("${installerName}")`).click();
  }

  /**
   * Click assign button
   */
  async clickAssign(): Promise<void> {
    await this.assignButton.click();
  }

  /**
   * Confirm assignment in modal
   */
  async confirmAssignment(): Promise<void> {
    await this.page.locator('ion-modal ion-button:has-text("Confirm"), ion-modal ion-button:has-text("확인")').click();
    await this.waitForLoadingComplete();
  }

  /**
   * Cancel assignment in modal
   */
  async cancelAssignment(): Promise<void> {
    await this.page.locator('ion-modal ion-button:has-text("Cancel"), ion-modal ion-button:has-text("취소")').click();
  }

  /**
   * Assign orders to installer
   */
  async assignOrdersToInstaller(orderNumbers: string[], installerName: string): Promise<void> {
    await this.selectOrders(orderNumbers);
    await this.selectInstaller(installerName);
    await this.clickAssign();
    await this.confirmAssignment();
  }

  /**
   * Get selected order count
   */
  async getSelectedCount(): Promise<number> {
    const countText = await this.selectedCount.textContent();
    return parseInt(countText || '0', 10);
  }

  /**
   * Get available installers
   */
  async getInstallerOptions(): Promise<string[]> {
    await this.installerSelect.click();
    const options = this.page.locator('ion-select-option');
    const texts: string[] = [];
    for (let i = 0; i < (await options.count()); i++) {
      texts.push((await options.nth(i).textContent()) || '');
    }
    // Close the dropdown
    await this.page.keyboard.press('Escape');
    return texts;
  }

  /**
   * Check if assign button is enabled
   */
  async isAssignButtonEnabled(): Promise<boolean> {
    return !(await this.assignButton.isDisabled());
  }

  /**
   * Go to assignment detail
   */
  async goToDetail(orderNumber: string): Promise<void> {
    await this.page.locator(`:has-text("${orderNumber}")`).first().click();
  }
}
