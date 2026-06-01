import { test, expect } from '@playwright/test';

test.describe('Manager portal smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
    await page.fill('input[name="password"]', 'change-me-on-first-login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);
  }

  test('super-admin can reach the manager dashboard', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/?portal=manager');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Sidebar shows the expected items
    await expect(page.getByRole('link', { name: /^Fleet$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Categories$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vehicle Types' })).toBeVisible();
  });

  test('categories page lists both seeded categories', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/manager/categories');
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    await expect(page.getByText('Car').first()).toBeVisible();
    await expect(page.getByText('Limousine').first()).toBeVisible();
  });

  test('vehicle types page lists 9 seeded sub-types', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/manager/types');
    await expect(page.getByRole('heading', { name: 'Vehicle Types' })).toBeVisible();
    // Spot-check a few seeded slugs
    await expect(page.getByText('economy', { exact: true })).toBeVisible();
    await expect(page.getByText('luxury', { exact: true })).toBeVisible();
    await expect(page.getByText('limo-stretch', { exact: true })).toBeVisible();
  });

  test('fleet new page renders the vehicle form', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSuperAdmin(page);
    await page.goto('/manager/fleet/new');
    await expect(page.getByRole('heading', { name: 'Add vehicle' })).toBeVisible();
    await expect(page.locator('select[name="typeId"]')).toBeVisible();
    await expect(page.locator('input[name="plate"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create vehicle' })).toBeVisible();
  });

  test('bulk import page shows the CSV uploader + template link', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSuperAdmin(page);
    await page.goto('/manager/fleet/bulk');
    await expect(page.getByRole('heading', { name: 'Bulk import vehicles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download template' })).toBeVisible();
  });
});
