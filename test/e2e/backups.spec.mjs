// Backups tab: back up, browse the backup, download a file, set a schedule, restore dialog.
import { test, expect } from '@playwright/test';

test('backups: back up, browse files, download, schedule', async ({ page }) => {
  test.setTimeout(90_000);
  const admin = page.context().request;
  const login = await admin.post(`${process.env.E2E_ADMIN_URL}/api/auth/login`, { data: { email: 'admin@example.com', password: 'correct-horse-battery' } });
  expect(login.status()).toBe(200);
  expect((await admin.put(`${process.env.E2E_ADMIN_URL}/api/admin/settings/backups`, { data: { enabled: true, storage: 'pbs', maxPerServer: 3 } })).status()).toBe(200);

  await page.goto(process.env.E2E_CUSTOMER_URL);
  await page.locator('#login-form [name=email]').fill('lena@example.com');
  await page.locator('#login-form [name=password]').fill('another-long-password');
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('.server-row[data-vmid="101"]').click();
  await page.locator('[data-tab=backups]').click();
  await expect(page.getByText('No backups yet.')).toBeVisible();

  await page.locator('[data-backup-now]').click();
  await expect(page.locator('.backup-progress')).toBeVisible();
  const item = page.locator('.backup-list li').first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await expect(item).toContainText('Made by you');

  // browse into the backup and download a file
  await item.locator('[data-backup-browse]').click();
  await page.locator('.file-name', { hasText: 'drive-scsi0.img.fidx' }).click();
  await page.locator('.file-name', { hasText: 'var' }).click();
  await page.locator('.file-name', { hasText: 'www' }).click();
  await expect(page.locator('.file-crumbs')).toContainText('www');
  const row = page.locator('.file-list li', { hasText: 'index.php' });
  const [download] = await Promise.all([page.waitForEvent('download'), row.getByText('Download').click()]);
  expect(download.suggestedFilename()).toBe('index.php');
  await page.locator('.file-crumbs button', { hasText: 'Backup' }).click();
  await expect(page.locator('.file-name', { hasText: 'drive-scsi0.img.fidx' })).toBeVisible();
  await page.locator('[data-browse-close]').click();

  // automatic backups, weekly
  const form = page.locator('#backup-schedule');
  await form.locator('[name=frequency]').selectOption('weekly');
  await form.locator('[name=weekday]').selectOption('6');
  await form.locator('[name=time]').fill('02:30');
  await form.locator('[name=keep]').fill('2');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toContainText('Next automatic backup');
  await expect(form.locator('[name=weekday]')).toHaveValue('6');
  await expect(form.locator('[name=time]')).toHaveValue('02:30');

  // the restore dialog explains what happens; cancel it
  await page.locator('.backup-list li').first().locator('[data-backup-restore]').click();
  await expect(page.locator('#restore-dialog')).toContainText('is replaced');
  await page.locator('#restore-dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#restore-dialog')).not.toBeVisible();
});
