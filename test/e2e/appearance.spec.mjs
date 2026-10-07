// The admin picks a color scheme; the customer portal shows it.
import { test, expect } from '@playwright/test';

test('a scheme chosen in Settings → Appearance reaches the customer portal', async ({ browser }) => {
  const admin = await browser.newPage();
  await admin.goto(process.env.E2E_ADMIN_URL);
  await admin.locator('#login-form [name=email]').fill('admin@example.com');
  await admin.locator('#login-form [name=password]').fill('correct-horse-battery');
  await admin.locator('#login-form button[type=submit]').click();
  await admin.locator('[data-admin-tab=settings]').click();
  await admin.locator('[data-scheme-pick="ember"]').click();
  await expect(admin.locator('html')).toHaveAttribute('data-scheme', 'ember');   // live preview
  await admin.locator('[data-scheme-save]').click();
  await expect(admin.locator('[data-scheme-pick="ember"] .pill')).toContainText('Active');

  const customer = await browser.newPage();
  await customer.goto(process.env.E2E_CUSTOMER_URL);
  await expect(customer.locator('html')).toHaveAttribute('data-scheme', 'ember');
  const accent = await customer.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim());
  expect(['#b9400f', '#ff8f57']).toContain(accent);                               // light or dark variant

  // back to the default, so other tests see the usual look
  await admin.locator('[data-scheme-pick="harbor"]').click();
  await admin.locator('[data-scheme-save]').click();
  await expect(admin.locator('[data-scheme-pick="harbor"] .pill')).toContainText('Active');
});
