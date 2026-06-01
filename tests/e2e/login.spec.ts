import { test, expect } from '@playwright/test';

test('a registered user can log in and is redirected to /dashboard', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@test.com`;
  const password = 'a-strong-password';

  // Register a fresh customer via API
  const reg = await request.post('/api/auth/register', {
    data: { email, password, fullName: 'E2E User' },
  });
  expect(reg.status()).toBe(201);

  // Use the login page (clean cookies first)
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'nobody@test.com');
  await page.fill('input[name="password"]', 'whatever12345');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('alert')).toBeVisible();
});
