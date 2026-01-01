import { test, expect } from '@playwright/test';

test('check i18n Korean translations', async ({ page }) => {
  await page.goto('http://localhost:4200');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Get body text
  const bodyText = await page.textContent('body') || '';
  console.log('=== BODY TEXT START ===');
  console.log(bodyText);
  console.log('=== BODY TEXT END ===');
  
  // Screenshot
  await page.screenshot({ path: 'e2e-tmp/i18n-check.png', fullPage: true });
});
