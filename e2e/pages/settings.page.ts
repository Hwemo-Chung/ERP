/**
 * Settings Page Object Model
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class SettingsPage extends BasePage {
  // Locators
  private readonly settingsMenu = this.page.locator('ion-list.settings-menu');
  private readonly notificationToggles = this.page.locator('ion-toggle[name*="notification"]');
  private readonly languageSelect = this.page.locator('ion-select[name="language"]');
  private readonly themeSelect = this.page.locator('ion-select[name="theme"]');
  private readonly logoutButton = this.page.locator('ion-button:has-text("Logout"), ion-button:has-text("로그아웃")');
  private readonly saveButton = this.page.locator('ion-button:has-text("Save"), ion-button:has-text("저장")');
  private readonly profileSection = this.page.locator('.profile-section, [data-testid="profile"]');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings');
    await this.waitForLoad();
  }

  /**
   * Go to specific settings section
   */
  async gotoSection(section: 'profile' | 'notifications' | 'settlement' | 'appearance'): Promise<void> {
    await this.page.goto(`/settings/${section}`);
    await this.waitForLoad();
  }

  /**
   * Toggle notification setting
   */
  async toggleNotification(notificationType: 'reassign' | 'delay' | 'customer' | 'push'): Promise<void> {
    const toggle = this.page.locator(`ion-toggle[name="${notificationType}"], ion-toggle[data-type="${notificationType}"]`);
    await toggle.click();
  }

  /**
   * Get notification setting state
   */
  async isNotificationEnabled(notificationType: string): Promise<boolean> {
    const toggle = this.page.locator(`ion-toggle[name="${notificationType}"], ion-toggle[data-type="${notificationType}"]`);
    const checked = await toggle.getAttribute('aria-checked');
    return checked === 'true';
  }

  /**
   * Select language
   */
  async selectLanguage(language: 'ko' | 'en'): Promise<void> {
    await this.languageSelect.click();
    await this.page.locator(`ion-select-option[value="${language}"]`).click();
  }

  /**
   * Select theme
   */
  async selectTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.themeSelect.click();
    await this.page.locator(`ion-select-option[value="${theme}"]`).click();
  }

  /**
   * Click logout button
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
    // Wait for redirect to login
    await this.page.waitForURL(/\/auth\/login/);
  }

  /**
   * Save settings
   */
  async saveSettings(): Promise<void> {
    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Go to settlement settings (admin only)
   */
  async gotoSettlement(): Promise<void> {
    await this.page.locator('ion-item:has-text("Settlement"), ion-item:has-text("정산")').click();
    await this.waitForLoad();
  }

  /**
   * Lock settlement for date
   */
  async lockSettlement(date: string): Promise<void> {
    await this.page.locator(`ion-item[data-date="${date}"] ion-button:has-text("Lock")`).click();
    await this.waitForLoadingComplete();
  }

  /**
   * Unlock settlement for date
   */
  async unlockSettlement(date: string): Promise<void> {
    await this.page.locator(`ion-item[data-date="${date}"] ion-button:has-text("Unlock")`).click();
    await this.waitForLoadingComplete();
  }

  /**
   * Check if settlement is locked
   */
  async isSettlementLocked(date: string): Promise<boolean> {
    const lockIcon = this.page.locator(`ion-item[data-date="${date}"] ion-icon[name="lock-closed"]`);
    return lockIcon.isVisible();
  }

  /**
   * Update profile field
   */
  async updateProfileField(fieldName: string, value: string): Promise<void> {
    const input = this.page.locator(`ion-input[name="${fieldName}"], input[name="${fieldName}"]`);
    await input.fill(value);
  }

  /**
   * Get profile field value
   */
  async getProfileFieldValue(fieldName: string): Promise<string> {
    const input = this.page.locator(`ion-input[name="${fieldName}"], input[name="${fieldName}"]`);
    return (await input.inputValue()) || '';
  }
}
