/**
 * Login Page Object Model
 */
import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  // Locators
  private readonly usernameInput = this.page.locator('ion-input[name="username"], input[name="username"]');
  private readonly passwordInput = this.page.locator('ion-input[name="password"], input[name="password"]');
  private readonly loginButton = this.page.locator('ion-button[type="submit"], button[type="submit"]');
  private readonly errorMessage = this.page.locator('.error-message, ion-text[color="danger"]');
  private readonly rememberMeCheckbox = this.page.locator('ion-checkbox[name="rememberMe"]');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/auth/login');
    await this.waitForLoad();
  }

  /**
   * Login with credentials
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Login and expect success (redirects to dashboard)
   */
  async loginAndExpectSuccess(username: string, password: string): Promise<void> {
    await this.login(username, password);
    await expect(this.page).toHaveURL(/\/(dashboard|orders|assignment)/);
  }

  /**
   * Login and expect failure
   */
  async loginAndExpectError(username: string, password: string): Promise<void> {
    await this.login(username, password);
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) || '';
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe(): Promise<void> {
    await this.rememberMeCheckbox.click();
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible(): Promise<boolean> {
    return this.usernameInput.isVisible();
  }

  /**
   * Check if user is logged in (redirected away from login)
   */
  async isLoggedIn(): Promise<boolean> {
    return !this.page.url().includes('/auth/login');
  }
}
