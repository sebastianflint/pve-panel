import { test, expect } from '@playwright/test';
import { startStack } from '../support/stack.mjs';

test('customer root reset requires matching passwords and confirmation, then clears secrets',async({browser})=>{
 const stack=await startStack({env:{SETUP_CHECK_HOURS:'0',CT_PASSWORD_RESET_ENABLED:'true',CT_PASSWORD_RESET_NODE:'pve1',CT_PASSWORD_RESET_HOST:'127.0.0.1',CT_PASSWORD_RESET_KEY_FILE:'/unused-key',CT_PASSWORD_RESET_KNOWN_HOSTS_FILE:'/unused-known-hosts'}});
 const context=await browser.newContext();
 try{
  const admin=await stack.adminSession(); const customer=await stack.customerWith('reset-ui@example.com',{limits:{}});
  const image=await admin.put('/api/admin/ct-templates',{volid:'local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst',node:'pve1',label:'Debian',storage:'local-lvm'});
  const made=await customer.post('/api/vms',{hostname:'reset-ui',templateId:'ct-'+image.json.id,cores:1,memoryMb:512,diskGb:4,password:'original-password-123'});
  expect(made.status).toBe(202); const id=made.json.vmid; await stack.serverSettled(customer,id);
  const page=await context.newPage();
  await page.request.post(stack.customerUrl+'/api/auth/login',{data:{email:'reset-ui@example.com',password:'another-long-password'}});
  let requests=0;
  await page.route('**/api/vms/'+id+'/root-password',async route=>{requests++;expect(route.request().postDataJSON()).toEqual({password:'new-password-123'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({changed:true})});});
  await page.goto(stack.customerUrl+'/#vm='+id);
  await page.locator('.unit[data-vmid="'+id+'"]').click();
  await page.locator('[data-root-password]').click();
  const form=page.locator('#root-password-form');
  await form.locator('[data-generate]').click();
  const generated=await form.locator('[name=password]').inputValue();
  expect(generated.length).toBeGreaterThanOrEqual(12);
  await expect(form.locator('[name=password2]')).toHaveValue(generated);
  await expect(form.locator('[name=password]')).toHaveAttribute('type','text');
  expect(requests).toBe(0);
  await form.locator('[name=password]').fill('new-password-123');
  await form.locator('[name=password2]').fill('wrong-password-123');
  await form.locator('[type=submit]').click();
  await expect(page.locator('#root-password-error')).toContainText("don't match");expect(requests).toBe(0);
  await form.locator('[name=password2]').fill('new-password-123');
  await form.locator('[type=submit]').click();
  await expect(page.locator('#confirm')).toBeVisible();expect(requests).toBe(0);
  await page.locator('#confirm-ok').click();
  await expect(page.locator('.toast').last()).toContainText('Root password changed');
  await expect(form).toHaveCount(0); expect(requests).toBe(1);
 }finally{await context.close();await stack.stop();}
});
