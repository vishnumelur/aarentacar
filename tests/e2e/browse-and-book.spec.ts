import { test, expect } from '@playwright/test';

test.describe('Browse & Book', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('public landing has the search widget + Browse navigates to /cars', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /AA Rent A Car/ })).toBeVisible();
    await expect(page.locator('button:has-text("Car")')).toBeVisible();
    await expect(page.locator('button:has-text("Limousine")')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();

    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/cars\?/);
  });

  test('manager bookings nav exists and the page renders', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
    await page.fill('input[name="password"]', 'change-me-on-first-login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/?portal=manager');
    await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible();
    await page.getByRole('link', { name: 'Bookings' }).click();
    await expect(page).toHaveURL(/\/manager\/bookings/);
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
  });
});
