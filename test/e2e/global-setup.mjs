// Starts the stack once and seeds what the browser tests need.
import { startStack } from '../support/stack.mjs';

export default async function globalSetup() {
  const stack = await startStack();
  await stack.offerTemplates();
  const lena = await stack.customerWith('lena@example.com', { limits: {} });
  const admin = await stack.adminSession();
  await admin.put('/api/admin/vms/101', { userId: lena.userId, label: 'Lena web' });

  process.env.E2E_CUSTOMER_URL = stack.customerUrl;
  process.env.E2E_ADMIN_URL = stack.adminUrl;
  return async () => stack.stop();
}
