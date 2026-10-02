import { test, expect } from '@playwright/test';

const signIn = async (page) => {
  await page.goto(process.env.E2E_CUSTOMER_URL);
  await page.locator('#login-form [name=email]').fill('lena@example.com');
  await page.locator('#login-form [name=password]').fill('another-long-password');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#app-view')).toBeVisible();
};

test('signs in and sees only her server', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('.server-row')).toHaveCount(1);
  await expect(page.locator('.server-row[data-vmid="101"]')).toContainText('Lena web');
});

test('opens the server page with specs and power actions', async ({ page }) => {
  await signIn(page);
  await page.locator('.server-row[data-vmid="101"]').click();
  await expect(page.locator('#detail h1')).toContainText('Lena web');
  await expect(page.locator('.specs')).toContainText('Server ID');
  await expect(page.locator('[data-power="start"]')).toBeVisible();
});

test('creates a Linux server through the form', async ({ page }) => {
  await signIn(page);
  await page.locator('#new-server').click();
  await expect(page.locator('#create-form')).toBeVisible();
  await page.getByText('Debian 12').click();
  await page.locator('#create-form [name=hostname]').fill('e2e-web');
  await page.locator('#create-form [name=password]').fill('supersecret-123');
  await page.locator('#create-form .btn.primary').click();
  // the app opens the new server; the sidebar shows its progress until it's ready
  const entry = page.locator('.unit', { hasText: 'e2e-web' });
  await expect(entry).toBeVisible();
  await expect(entry).not.toContainText(/Setting up/i, { timeout: 60_000 });
  await expect(entry).not.toContainText(/failed/i);
});

test('wrong password shows an error and stays on the sign-in page', async ({ page }) => {
  await page.goto(process.env.E2E_CUSTOMER_URL);
  await page.locator('#login-form [name=email]').fill('lena@example.com');
  await page.locator('#login-form [name=password]').fill('not-the-password');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#login-error')).toContainText('incorrect');
  await expect(page.locator('#app-view')).toBeHidden();
});
