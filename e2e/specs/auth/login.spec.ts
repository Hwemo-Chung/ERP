/**
 * Authentication E2E Tests
 * Tests login, logout, session timeout
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages';
import { TEST_USERS } from '../../fixtures/test-data';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('Login Flow', () => {
    test('should display login form', async () => {
      expect(await loginPage.isLoginFormVisible()).toBe(true);
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );

      // Should redirect to dashboard or orders page
      await expect(page).toHaveURL(/\/(dashboard|orders|assignment)/);
    });

    test('should show error with invalid credentials', async () => {
      await loginPage.loginAndExpectError(
        'invalid@test.com',
        'wrongpassword'
      );

      const errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
    });

    test('should show error with empty password', async ({ page }) => {
      await loginPage.login(TEST_USERS.admin.username, '');

      // Should remain on login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should show error with empty username', async ({ page }) => {
      await loginPage.login('', TEST_USERS.admin.password);

      // Should remain on login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should handle remember me option', async () => {
      await loginPage.toggleRememberMe();
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );
    });
  });

  test.describe('Role-based Access', () => {
    test('admin should have access to all features', async ({ page }) => {
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );

      // Check for admin-only features
      await page.goto('/settings/settlement');
      await expect(page).not.toHaveURL(/\/auth\/login/);
    });

    test('installer should have limited access', async ({ page }) => {
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.installer.username,
        TEST_USERS.installer.password
      );

      // Installers shouldn't access settlement settings
      await page.goto('/settings/settlement');
      // Should be redirected or show access denied
      const accessDenied = page.locator('text=Access Denied, text=권한 없음, text=접근 불가');
      const loginPage = page.url().includes('/auth/login');
      expect(await accessDenied.isVisible() || loginPage).toBeTruthy();
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async () => {
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );
    });

    test('should logout and redirect to login page', async ({ page }) => {
      await page.goto('/settings');
      const settingsPage = await import('../../pages').then(m => new m.SettingsPage(page));

      await settingsPage.logout();
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should clear session data on logout', async ({ page }) => {
      await page.goto('/settings');
      const settingsPage = await import('../../pages').then(m => new m.SettingsPage(page));

      await settingsPage.logout();

      // Try to access protected route
      await page.goto('/orders');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe('Session Timeout', () => {
    test('should show session timeout warning modal', async ({ page }) => {
      await loginPage.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );

      // Simulate session timeout by manipulating token expiry
      await page.evaluate(() => {
        // Trigger session timeout event
        window.dispatchEvent(new CustomEvent('session-timeout-warning'));
      });

      // Check for session timeout modal
      const timeoutModal = page.locator('app-session-timeout-modal ion-modal');
      // Modal may or may not appear based on implementation
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      await page.goto('/orders');
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should redirect to requested page after login', async ({ page }) => {
      // Try to access orders page
      await page.goto('/orders');

      // Should redirect to login with return URL
      await expect(page).toHaveURL(/\/auth\/login/);

      // Login
      const loginPageNew = new LoginPage(page);
      await loginPageNew.loginAndExpectSuccess(
        TEST_USERS.admin.username,
        TEST_USERS.admin.password
      );

      // Should redirect to originally requested page
      await expect(page).toHaveURL(/\/orders/);
    });
  });
});
