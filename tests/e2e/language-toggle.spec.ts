import { test, expect } from '@playwright/test';

test('language toggle flips <html dir> to rtl when switching to Arabic', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  // The button label is either "العربية" or "English" depending on current locale.
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
