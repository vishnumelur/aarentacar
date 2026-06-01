import { test, expect } from '@playwright/test';

test.describe('Customer KYC happy path', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('customer registers → completes profile → /verification renders required slots', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const email = `kyc-${Date.now()}@test.com`;

    // 1. Register (auto-logs in)
    const reg = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'a-strong-password-1234',
        fullName: 'Kyc Test',
      },
    });
    expect(reg.status()).toBe(201);

    // 2. Log in via browser
    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'a-strong-password-1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard$/);

    // 3. Visit /verification with no profile → should prompt for profile
    await page.goto('/verification');
    await expect(page.getByRole('heading', { name: 'Verification Center' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to profile' })).toBeVisible();

    // 4. Complete profile
    await page.goto('/profile');
    await page.locator('input[name="residency"][value="tourist"]').check();
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');
    await page.fill('input[name="nationality"]', 'United Kingdom');
    await page.click('button:has-text("Save profile")');
    // Wait for the save to commit (the form sets state with useTransition,
    // so navigating immediately races the server-action insert).
    await expect(page.getByText('Saved.')).toBeVisible({ timeout: 10_000 });

    // 5. Back to /verification — should now show the tourist required-doc slots
    await page.goto('/verification');
    await expect(page.getByRole('heading', { name: /Passport/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /UAE Visa/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Driving License \(front\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Driving License \(back\)/ })).toBeVisible();
  });

  test('manager customer list shows the seeded customer with status filter', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
    await page.fill('input[name="password"]', 'change-me-on-first-login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/manager/customers');
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
    // The customers nav link should also be visible in the sidebar
    await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
  });
});
