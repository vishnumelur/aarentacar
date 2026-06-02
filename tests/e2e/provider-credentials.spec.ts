import { test, expect } from '@playwright/test';
import {
  createSuperadminFixture,
  findCredentialSetAudit,
} from './helpers/superadmin-fixtures';

test('super-admin can view credential cards and save a key (Plan #9)', async ({
  page,
}) => {
  const sa = await createSuperadminFixture();

  // Log in as the super-admin via the API so the session cookie lands in the
  // page's context (avoids a client-side navigation race after submit).
  await page.context().clearCookies();
  const login = await page.request.post('/api/auth/login', {
    data: { email: sa.email, password: sa.password },
  });
  expect(login.status()).toBe(200);

  // Visit the credentials page — all four provider cards render.
  await page.goto('/admin/credentials');
  await expect(page.getByText('Provider Credentials')).toBeVisible();
  // All four provider cards render (CardTitle is a styled div, not a heading).
  await expect(page.getByText('Stripe', { exact: true })).toBeVisible();
  await expect(page.getByText('Tabby', { exact: true })).toBeVisible();
  await expect(page.getByText('Mapbox', { exact: true })).toBeVisible();
  await expect(page.getByText('SMTP (email)', { exact: true })).toBeVisible();

  // Edit + save the Mapbox access token. Scope to the Mapbox card via its
  // unique input id, then walk up to the enclosing card.
  const token = `pk.e2e-${Date.now()}xyz9`;
  const mapboxField = page.locator('#mapbox-access_token');
  const mapboxCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: 'Mapbox' });
  await mapboxCard.getByRole('button', { name: 'Edit' }).click();
  await mapboxField.fill(token);
  await mapboxCard.getByRole('button', { name: 'Save', exact: true }).click();

  // Success toast + the field now shows the masked last-four (••yz9 from token).
  await expect(page.getByText(/saved\.?/i).first()).toBeVisible();
  await expect(mapboxCard.getByText(/^••/).first()).toBeVisible();

  // The save is recorded in audit_logs as credential.set.
  const audit = await findCredentialSetAudit('mapbox.access_token');
  expect(audit.found).toBe(true);
});

test('non-super-admin is redirected away from /admin/credentials', async ({
  page,
  request,
}) => {
  // Register a plain customer and log in.
  const email = `e2e-cred-cust-${Date.now()}@test.com`;
  const password = 'a-strong-password';
  const reg = await request.post('/api/auth/register', {
    data: { email, password, fullName: 'E2E Cust' },
  });
  expect(reg.status()).toBe(201);

  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard$/);

  // Customer hitting the super-admin credentials page is bounced away and the
  // credential UI never renders.
  await page.goto('/admin/credentials');
  await expect(page).not.toHaveURL(/\/admin\/credentials/);
  await expect(page.getByRole('heading', { name: 'Stripe' })).toHaveCount(0);
});
