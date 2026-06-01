import { test, expect } from '@playwright/test';

test('dev portal override via ?portal=manager redirects unauthed users to /login', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto('/?portal=manager');
  // Manager layout requires auth → server-side redirect to /login
  await expect(page).toHaveURL(/\/login$/);
});
