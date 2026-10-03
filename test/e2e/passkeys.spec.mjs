// Passkeys in a real browser, with Chromium's virtual authenticator
// (a simulated fingerprint device). Passkeys need a domain name: localhost.
import { test, expect } from '@playwright/test';

const url = () => process.env.E2E_CUSTOMER_URL.replace('127.0.0.1', 'localhost');

test('adds a passkey on the account page and signs in with it', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
    },
  });

  // sign in with the password, open Account, add a passkey
  await page.goto(url());
  await page.locator('#login-form [name=email]').fill('lena@example.com');
  await page.locator('#login-form [name=password]').fill('another-long-password');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#app-view')).toBeVisible();
  await page.locator('#nav-account').click();
  await page.locator('[data-add-passkey]').click();
  await expect(page.locator('#prompt')).toBeVisible();          // "Name this passkey"
  await page.locator('#prompt-input').fill('Test laptop');
  await page.locator('#prompt-ok').click();
  await expect(page.locator('.passkey-list li')).toContainText('Test laptop');

  // sign out, then sign in with only the passkey
  await page.locator('#logout').click();
  await expect(page.locator('.passkey-btn')).toBeVisible();
  await page.locator('.passkey-btn').click();
  await expect(page.locator('#app-view')).toBeVisible();
  await expect(page.locator('#account-email')).toContainText('lena@example.com');
});

test('the passkey option is hidden on a bare IP address', async ({ page }) => {
  await page.goto(process.env.E2E_CUSTOMER_URL);   // 127.0.0.1
  await expect(page.locator('#login-form [name=email]')).toBeVisible();
  await expect(page.locator('.passkey-btn')).toHaveCount(0);
});
