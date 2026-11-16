import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startStack } from '../support/stack.mjs';

let stack, owner, other, admin, vmid, dir, capture, executable;
const supported = process.platform !== 'win32';
before(async () => {
 if (!supported) return;
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'ct-reset-test-'));
 capture=path.join(dir,'captured.json'); executable=path.join(dir,'ssh-helper.mjs');
 fs.writeFileSync(executable, `#!/usr/bin/env node\nimport fs from 'node:fs'; let s=''; for await(const p of process.stdin) s+=p; fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({args:process.argv.slice(2),request:JSON.parse(s)})); console.log(JSON.stringify({changed:true}));`);
 fs.chmodSync(executable,0o700);
 stack=await startStack({env:{SETUP_CHECK_HOURS:'0',CT_PASSWORD_RESET_ENABLED:'true',CT_PASSWORD_RESET_NODE:'pve1',CT_PASSWORD_RESET_HOST:'127.0.0.1',CT_PASSWORD_RESET_KEY_FILE:path.join(dir,'key'),CT_PASSWORD_RESET_KNOWN_HOSTS_FILE:path.join(dir,'known-hosts'),CT_PASSWORD_RESET_SSH_BIN:executable}});
 admin=await stack.adminSession(); owner=await stack.customerWith('owner@example.com',{limits:{}}); other=await stack.customerWith('other@example.com');
 const offered=await admin.put('/api/admin/ct-templates',{volid:'local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst',node:'pve1',label:'Debian',storage:'local-lvm'});
 const created=await owner.post('/api/vms',{hostname:'password-test',templateId:'ct-'+offered.json.id,cores:1,memoryMb:512,diskGb:4,password:'initial-password-123'});
 assert.equal(created.status,202,created.text); vmid=created.json.vmid;
 assert.equal((await stack.serverSettled(owner,vmid)).state,'ready');
});
after(async()=>{await stack?.stop(); if(dir)fs.rmSync(dir,{recursive:true,force:true});});
const options={skip:!supported};

test('only the owner can reset; VM and privileged/stopped/locked containers are refused', options, async()=>{
 const post=(session,id)=>session.post(`/api/vms/${id}/root-password`,{password:'changed-password-123'});
 assert.equal((await post(stack.customer(),vmid)).status,401);
 assert.equal((await post(other,vmid)).status,404);
 assert.equal((await post(owner,999999)).status,404);
 await admin.put('/api/admin/vms/101',{userId:owner.userId});
 assert.equal((await post(owner,101)).status,400);
 const ct=stack.mock.vms.get(vmid);
 ct.cfg.unprivileged=0; assert.equal((await post(owner,vmid)).status,409); ct.cfg.unprivileged=1;
 ct.status='stopped'; assert.equal((await post(owner,vmid)).status,409); ct.status='running';
 ct.cfg.lock='backup'; assert.equal((await post(owner,vmid)).status,409); delete ct.cfg.lock;
 assert.equal(fs.existsSync(capture),false);
});

test('validates passwords, sends them only on stdin and records a secret-free audit', options, async()=>{


 assert.equal((await owner.post(`/api/vms/${vmid}/root-password`,{password:'short'})).status,400);
 assert.equal((await owner.post(`/api/vms/${vmid}/root-password`,{password:'long-password\nroot:bad'})).status,400);
 const password='quotes-"-$()-;: password-123';
 const changed=await owner.post(`/api/vms/${vmid}/root-password`,{password});
 assert.equal(changed.status,200,changed.text); assert.deepEqual(changed.json,{changed:true});
 const data=JSON.parse(fs.readFileSync(capture,'utf8'));
 assert.deepEqual(data.request,{vmid,password}); assert.ok(!data.args.some(a=>a.includes(password)));
 assert.ok(data.args.includes('StrictHostKeyChecking=yes')); assert.equal(data.args.at(-1),'reset-root-password-v1');
 const log=(await admin.get('/api/admin/audit?limit=30')).json;
 assert.ok(log.some(x=>x.action==='ct_root_password_reset'&&x.vmid===vmid&&x.email==='owner@example.com'));
 assert.ok(!JSON.stringify(log).includes(password)); assert.ok(!stack.logs().includes(password));
 // Backend/SSH failures remain generic and cannot echo an injected secret.
 fs.writeFileSync(executable,"#!/usr/bin/env node\nprocess.stdin.resume(); process.stdin.on('end',()=>{console.error('private-secret-detail'); console.log(JSON.stringify({error:'private-secret-detail'})); process.exitCode=1;});");
 const failure=await owner.post(`/api/vms/${vmid}/root-password`,{password:'another-password-123'});
 assert.equal(failure.status,502,failure.text); assert.ok(!failure.text.includes('private-secret-detail')); assert.ok(!stack.logs().includes('private-secret-detail'));
});
