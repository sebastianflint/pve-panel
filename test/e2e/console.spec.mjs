import { test, expect } from '@playwright/test';
import { startStack } from '../support/stack.mjs';

test('CT console supports text, Unicode input, clipboard, resize and reconnect; VM keeps noVNC',async({browser})=>{
 test.setTimeout(90000);
 const stack=await startStack({env:{VPN_ENABLED:'false',CUSTOMER_NETWORKS:'false',SETUP_CHECK_HOURS:'0'}});
 const context=await browser.newContext();
 try {
  stack.mock.vms.set(120,{vmid:120,node:'pve1',type:'lxc',name:'ct-console',pool:'customers',status:'running',maxcpu:1,maxmem:512*2**20,maxdisk:4*2**30,cfg:{cores:1,memory:512,unprivileged:1,ostype:'debian',rootfs:'VMStorage:subvol-120-disk-0,size=4G'}});
  const admin=await stack.adminSession();const owner=await stack.customerWith('terminal-ui@example.com');
  for(const id of [120,102])await admin.put('/api/admin/vms/'+id,{userId:owner.userId});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:stack.customerUrl});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.request.post(stack.customerUrl+'/api/auth/login',{data:{email:'terminal-ui@example.com',password:'another-long-password'}});
  await page.goto(stack.customerUrl+'/console.html?vmid=120');
  await expect(page.locator('#console-led')).toHaveClass(/running/);
  await expect(page.locator('.xterm')).toBeVisible();
  await expect(page.locator('#cad')).toBeHidden();
  await expect(page.locator('#copy')).toBeVisible();
  await expect(page.locator('#screen')).toContainText('Mock CT terminal ready');
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('citta ');
  await expect.poll(()=>Buffer.concat(stack.mock.terminalSessions.at(-1).inputs).toString()).toContain('citta ');
  await page.evaluate(()=>navigator.clipboard.writeText('incolla-è 🐧'));
  await page.locator('#paste').click();
  await expect.poll(()=>Buffer.concat(stack.mock.terminalSessions.at(-1).inputs).toString()).toContain('incolla-è 🐧');
  const box=await page.locator('.xterm-screen').boundingBox();
  await page.mouse.move(box.x+1,box.y+25);await page.mouse.down();await page.mouse.move(box.x+150,box.y+25,{steps:10});await page.mouse.up();
  await expect(page.locator('#copy')).toBeEnabled();await page.locator('#copy').click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('Mock');
  const before=stack.mock.terminalSessions.at(-1).sizes.at(-1);
  await page.setViewportSize({width:900,height:600});
  await expect.poll(()=>stack.mock.terminalSessions.at(-1).sizes.at(-1)?.cols).toBeLessThan(before.cols);
  const count=stack.mock.terminalSessions.length;
  await page.locator('#reconnect').click();
  await expect.poll(()=>stack.mock.terminalSessions.length).toBe(count+1);
  await expect(page.locator('#console-led')).toHaveClass(/running/);
  await expect(page.locator('#screen')).toContainText('Mock CT terminal ready');
  await page.goto(stack.customerUrl+'/console.html?vmid=102');
  await expect(page.locator('#screen canvas')).toHaveCount(1);
  await expect(page.locator('.xterm')).toHaveCount(0);
  await expect(page.locator('#cad')).toBeVisible();
  await expect(page.locator('#copy')).toBeHidden();
  expect(stack.mock.consoleRequests.at(-1).type).toBe('vnc');
  expect(errors).toEqual([]);
 }finally{await context.close();await stack.stop();}
});
