import { test, expect } from '@playwright/test';
import { startStack } from '../support/stack.mjs';

test('admin configures and clears an LXC access VLAN without SDN', async ({ browser }) => {
  const stack = await startStack({ env: { CUSTOMER_NETWORKS: 'false', VPN_ENABLED: 'false', SETUP_CHECK_HOURS: '0' } });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.request.post(`${stack.adminUrl}/api/auth/login`, { data: { email: 'admin@example.com', password: 'correct-horse-battery' } });
    await page.goto(stack.adminUrl);
    await page.locator('[data-admin-tab=templates]').click();
    const row = page.locator('tr[data-ct]', { hasText: 'debian-13-standard' });
    await row.locator('[data-f=offered]').check();
    await row.locator('[data-f=label]').fill('Tagged Debian');
    await row.locator('[data-f=storage]').selectOption('local-lvm');
    await row.locator('[data-f=bridge]').fill('vmbr0');
    await row.locator('[data-f=vlanTag]').fill('901');
    await row.locator('[data-save-ct]').click();
    await expect(page.locator('.toast').last()).toContainText('is offered to customers');
    await page.reload();
    await page.locator('[data-admin-tab=templates]').click();
    await expect(row.locator('[data-f=vlanTag]')).toHaveValue('901');
    await expect(row.locator('[data-f=bridge]')).toHaveValue('vmbr0');
    await expect(row.locator('[data-f=storage]')).toHaveValue('local-lvm');
    await row.locator('[data-f=vlanTag]').fill('');
    await row.locator('[data-save-ct]').click();
    await expect.poll(async () => {
      const data = await (await page.request.get(`${stack.adminUrl}/api/admin/templates`)).json();
      return data.containers.find(c => c.label === 'Tagged Debian')?.vlanTag;
    }).toBe(null);
  } finally {
    await context.close();
    await stack.stop();
  }
});
