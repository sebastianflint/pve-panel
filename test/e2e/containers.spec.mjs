// Container images: offered in the admin Templates tab, created through the customer's form.
import { test, expect } from '@playwright/test';

test('offer a container image and create a container from it', async ({ page, browser }) => {
  test.setTimeout(90_000);
  // admin: offer the Debian image in the Templates tab
  const adminPage = await (await browser.newContext()).newPage();
  await adminPage.request.post(`${process.env.E2E_ADMIN_URL}/api/auth/login`, { data: { email: 'admin@example.com', password: 'correct-horse-battery' } });
  await adminPage.goto(process.env.E2E_ADMIN_URL);
  await adminPage.locator('[data-admin-tab=templates]').click();
  const row = adminPage.locator('tr[data-ct]', { hasText: 'debian-13-standard' });
  await expect(row).toBeVisible();
  await row.locator('[data-f=offered]').check();
  await row.locator('[data-f=label]').fill('Debian 13 (container)');
  await row.locator('[data-f=storage]').selectOption('local-lvm');
  await row.locator('[data-save-ct]').click();
  await expect(adminPage.locator('.toast').last()).toContainText('is offered to customers');

  // customer: the image is a "Container", sign-in is root
  await page.goto(process.env.E2E_CUSTOMER_URL);
  await page.locator('#login-form [name=email]').fill('lena@example.com');
  await page.locator('#login-form [name=password]').fill('another-long-password');
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#new-server').click();
  const choice = page.locator('.choice', { hasText: 'Debian 13 (container)' });
  await expect(choice.locator('.tag')).toHaveText('Container');
  await choice.click();
  await expect(page.locator('#create-form [name=username]')).toBeHidden();
  await expect(page.locator('#create-form #windows-user')).toHaveText('root');
  await expect(page.locator('#create-form [name=sshKeys]')).toBeVisible();

  await page.locator('#create-form [name=hostname]').fill('ct-e2e');
  await page.locator('#create-form [name=diskGb]').fill('8');
  await page.locator('#create-form [name=password]').fill('supersecret-123');
  await page.locator('#create-submit').click();
  await expect(page.locator('.server-head h1')).toHaveText('ct-e2e', { timeout: 40_000 });
  await expect(page.locator('[data-tab=remote]')).toHaveCount(0, { timeout: 40_000 }); // no Tailscale tab for containers

  // clean up: the other browser tests share this panel and expect Lena's one server
  const api = page.request;
  const C = process.env.E2E_CUSTOMER_URL;
  const ct = (await (await api.get(`${C}/api/vms`)).json()).find((v) => v.name === 'ct-e2e' || v.hostname === 'ct-e2e');
  await expect.poll(async () => (await (await api.get(`${C}/api/vms`)).json()).find((v) => v.vmid === ct.vmid)?.state, { timeout: 30_000 }).toBe('ready');
  await api.post(`${C}/api/vms/${ct.vmid}/power/stop`);
  await expect.poll(async () => (await api.delete(`${C}/api/vms/${ct.vmid}`)).status(), { timeout: 20_000, intervals: [1000] }).toBe(202);
  await expect.poll(async () => (await (await api.get(`${C}/api/vms`)).json()).length, { timeout: 30_000 }).toBe(1);
  const offered = (await (await adminPage.request.get(`${process.env.E2E_ADMIN_URL}/api/admin/templates`)).json()).containers.find((c) => c.offered);
  await adminPage.request.delete(`${process.env.E2E_ADMIN_URL}/api/admin/ct-templates/${offered.id}`);
});
