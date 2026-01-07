/**
 * Base Page Object Model
 * Common functionality for all page objects
 */
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>;

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get toast message
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('ion-toast');
    if (await toast.isVisible()) {
      return toast.textContent();
    }
    return null;
  }

  /**
   * Wait for toast and verify message
   */
  async expectToast(expectedMessage: string): Promise<void> {
    const toast = this.page.locator('ion-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(expectedMessage);
  }

  /**
   * Click button by text
   */
  async clickButton(text: string): Promise<void> {
    await this.page.locator(`ion-button:has-text("${text}")`).click();
  }

  /**
   * Fill input field
   */
  async fillInput(label: string, value: string): Promise<void> {
    const input = this.page.locator(`ion-item:has(ion-label:has-text("${label}")) ion-input`);
    await input.fill(value);
  }

  /**
   * Select option from ion-select
   */
  async selectOption(label: string, optionText: string): Promise<void> {
    const select = this.page.locator(`ion-item:has(ion-label:has-text("${label}")) ion-select`);
    await select.click();
    await this.page.locator(`ion-select-option:has-text("${optionText}")`).click();
  }

  /**
   * Get loading spinner state
   */
  async isLoading(): Promise<boolean> {
    const spinner = this.page.locator('ion-spinner, ion-loading');
    return spinner.isVisible();
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    const spinner = this.page.locator('ion-spinner, ion-loading');
    await spinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
      // Spinner may not exist at all
    });
  }

  /**
   * Navigate back
   */
  async goBack(): Promise<void> {
    await this.page.locator('ion-back-button').click();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const title = this.page.locator('ion-title');
    return (await title.textContent()) || '';
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return (await element.count()) > 0;
  }

  /**
   * Take screenshot with descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }
}
