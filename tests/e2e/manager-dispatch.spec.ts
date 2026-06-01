import { test, expect } from '@playwright/test';
import { createDispatchFixture } from './helpers/dispatch-fixtures';

test.describe('Manager dispatch', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('approves a pending_approval booking and dispatches an available driver', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const fixture = await createDispatchFixture();

    // 1. Log in as the seeded super-admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
    await page.fill('input[name="password"]', 'change-me-on-first-login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);

    // 2. Navigate to the booking detail
    await page.goto(`/manager/bookings/${fixture.bookingCode}`);
    await expect(page.getByText(fixture.bookingCode)).toBeVisible();
    await expect(page.getByText(/pending approval/i)).toBeVisible();

    // 3. Click Approve in the ApprovalPanel
    await page.getByRole('button', { name: 'Approve booking' }).click();

    // 4. After refresh, status becomes 'approved' and DispatchPanel appears
    await expect(page.getByRole('heading', { name: 'Dispatch a driver' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Dispatch Test Driver')).toBeVisible();

    // 5. Confirm dispatch on the first row
    await page.getByRole('button', { name: 'Confirm dispatch' }).first().click();

    // 6. After refresh, status pill is 'dispatched'; DispatchPanel disappears
    await expect(page.getByText(/dispatched/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dispatch a driver' })).not.toBeVisible();
  });
});
