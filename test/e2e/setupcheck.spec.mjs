// Setup check tab: runs on first open, explains problems and how to fix them.
import { test, expect } from '@playwright/test';

test('setup check: runs on first open, shows problems with how to fix them', async ({ page }) => {
  await page.goto(process.env.E2E_ADMIN_URL);
  await page.locator('#login-form [name=email]').fill('admin@example.com');
  await page.locator('#login-form [name=password]').fill('correct-horse-battery');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#vm-rows tr').first()).toBeVisible();

  await page.locator('[data-admin-tab=setup]').click();
  await expect(page.locator('.check-item').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.check-group-title', { hasText: 'Proxmox connection' })).toBeVisible();
  await expect(page.locator('[data-check="pve:reach"]')).toHaveClass(/status-ok/);
  await expect(page.locator('.setup-verdict')).toBeVisible();

  // the test stack still has INITIAL_ADMIN_PASSWORD set: a warning with a fix
  const initial = page.locator('[data-check="sec:initial"]');
  await expect(initial).toHaveClass(/status-warn/);
  await initial.locator('summary', { hasText: 'How to fix' }).click();
  await expect(initial.locator('.check-fix')).toContainText('Remove INITIAL_ADMIN_PASSWORD');

  // problem count on the tab
  await expect(page.locator('[data-admin-tab=setup] .tab-count')).toHaveText(/^\d+$/);

  // only problems
  await page.locator('[data-setup-only]').check();
  await expect(page.locator('[data-check="pve:reach"]')).toHaveCount(0);
  await expect(page.locator('[data-check="sec:initial"]')).toBeVisible();

  // run again
  const before = await page.locator('.setup-head .small').textContent();
  await page.waitForTimeout(1100);
  await page.locator('[data-setup-run]').click();
  await expect(page.locator('[data-setup-run]')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('.setup-head .small')).not.toHaveText(before);
});
