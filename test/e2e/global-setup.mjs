// Starts the stack once and seeds what the browser tests need.
import { startStack } from '../support/stack.mjs';

export default async function globalSetup() {
  // every browser test signs in from 127.0.0.1: more than the usual 10 per minute
  const stack = await startStack({ env: { SIGNIN_RATE_LIMIT: '100' } });
  await stack.offerTemplates();
  const lena = await stack.customerWith('lena@example.com', { limits: {} });
  const admin = await stack.adminSession();
  await admin.put('/api/admin/vms/101', { userId: lena.userId, label: 'Lena web' });

  process.env.E2E_CUSTOMER_URL = stack.customerUrl;
  process.env.E2E_ADMIN_URL = stack.adminUrl;
  process.env.E2E_MOCK_URL = stack.mock.url;
  return async () => stack.stop();
}
