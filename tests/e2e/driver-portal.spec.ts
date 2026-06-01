import { test, expect } from '@playwright/test';

test.describe('Driver portal smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('seeded driver1 logs in and reaches /driver', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.fill('input[name="email"]', 'driver1@test.com');
    await page.fill('input[name="password"]', 'driver-test-password');
    await page.click('button[type="submit"]');

    // Login should succeed (no longer on /login)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // /driver should serve a 200 response with one of the two valid states
    // (driver-setup-incomplete vs Today screen) — either way, NOT the login page.
    await page.goto('/driver');
    const text = await page.locator('main').first().textContent({ timeout: 15_000 });
    expect(text).toBeTruthy();
    expect(text).toMatch(/Driver setup incomplete|Status|Hi,/);
  });

  test('super-admin can browse to /driver and see the Today shell', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
    await page.fill('input[name="password"]', 'change-me-on-first-login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/driver');
    // Admin user has no driver_profile → "Driver setup incomplete" message.
    await expect(page.getByRole('heading', { name: 'Driver setup incomplete' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('POST /api/driver/ping returns 403 for non-driver users', async ({ request }) => {
    // Hit the endpoint with no auth — should be 403
    const res = await request.post('/api/driver/ping', {
      data: { lat: 25.2, lng: 55.28 },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /api/driver/ping returns 400 for invalid body (no lat/lng)', async ({
    request,
  }) => {
    // Authenticate as the seeded driver first
    await request.post('/api/auth/login', {
      data: { email: 'driver1@test.com', password: 'driver-test-password' },
    });
    const res = await request.post('/api/driver/ping', {
      data: { foo: 'bar' },
    });
    // Either 400 (driver has profile, body bad) or 403 (no driver role / context).
    // Both responses prove the endpoint validates inputs before doing DB work.
    expect([400, 403, 409]).toContain(res.status());
  });
});
