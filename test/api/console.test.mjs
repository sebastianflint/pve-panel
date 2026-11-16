import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startStack, waitFor } from '../support/stack.mjs';
let stack, owner, other, admin;
const clients = new Set();
before(async () => {
 stack = await startStack({ env: { VPN_ENABLED:'false', CUSTOMER_NETWORKS:'false', SETUP_CHECK_HOURS:'0' } });
 stack.mock.vms.set(120,{vmid:120,node:'pve1',type:'lxc',name:'ct-console',pool:'customers',status:'running',maxcpu:1,maxmem:512*2**20,maxdisk:4*2**30,cfg:{cores:1,memory:512,unprivileged:1,ostype:'debian',rootfs:'VMStorage:subvol-120-disk-0,size=4G'}});
 admin=await stack.adminSession();owner=await stack.customerWith('terminal-owner@example.com');other=await stack.customerWith('terminal-other@example.com');
 for(const id of [120,102,101])assert.equal((await admin.put('/api/admin/vms/'+id,{userId:owner.userId})).status,200);
});
after(async()=>{for(const ws of clients)ws.terminate();await stack?.stop();});
async function session(id=120) {const r=await owner.post(`/api/vms/${id}/console`);assert.equal(r.status,200,r.text);return r.json;}
function open(id,account=owner,extra={}) {
 const cookies=[...account.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
 const ws=new WebSocket(stack.customerUrl.replace('http:','ws:')+'/api/console/'+id,{headers:{Cookie:cookies,...extra}});
 const messages=[];const closed=new Promise(resolve=>ws.on('close',(code)=>resolve(code)));
 ws.on('message',(data,binary)=>messages.push({data,binary}));ws.on('error',()=>{});clients.add(ws);
 return {ws,messages,closed};
}
async function ready(c) {await waitFor(()=>c.messages.some(m=>!m.binary&&m.data.toString()==='{"type":"ready"}'),{timeout:10000,what:'terminal ready'});}

test('console gate rejects stopped, unknown and other-customer servers',async()=>{
 assert.equal((await owner.post('/api/vms/101/console')).status,409);
 assert.equal((await other.post('/api/vms/120/console')).status,404);
 assert.equal((await owner.post('/api/vms/99999/console')).status,404);
});
test('CT tickets stay server-side; sessions bind to owner and are single-use',async()=>{
 const s=await session();assert.equal(s.type,'terminal');
 for(const field of ['password','ticket','user'])assert.equal(s[field],undefined);
 const borrowed=open(s.session,other);assert.equal(await borrowed.closed,4001);
 const c=open(s.session);await ready(c);
 assert.ok(stack.mock.terminalSessions.at(-1).authenticated);
 await waitFor(()=>c.messages.some(m=>m.binary&&m.data.toString().includes('Mock CT terminal ready')));
 assert.ok(c.messages.every(m=>!m.data.toString().includes('PVETERM:abc')));
 const replay=open(s.session);assert.equal(await replay.closed,4001);
 c.ws.close();
});
test('cross-origin websocket is refused without consuming the session',async()=>{
 const s=await session();const c=open(s.session,owner,{Origin:'https://untrusted.example'});
 const status=await new Promise(resolve=>c.ws.on('unexpected-response',(_,r)=>{resolve(r.statusCode);c.ws.terminate();}));assert.equal(status,403);
 const valid=open(s.session);await ready(valid);valid.ws.close();
});
test('ownership is rechecked when the websocket redeems a console session',async()=>{
 const s=await session();await admin.put('/api/admin/vms/120',{userId:other.userId});
 const c=open(s.session);assert.equal(await c.closed,4001);
 await admin.put('/api/admin/vms/120',{userId:owner.userId});
});
test('UTF-8 input and terminal size use the native Proxmox protocol',async()=>{
 const s=await session();const c=open(s.session);await ready(c);const target=stack.mock.terminalSessions.at(-1);
 const text='città 🐧\r';c.ws.send(JSON.stringify({type:'input',data:text}));c.ws.send(JSON.stringify({type:'resize',cols:132,rows:42}));
 await waitFor(()=>target.inputs.length&&target.sizes.length);
 assert.equal(target.inputs[0].toString(),text);assert.equal(target.inputs[0].length,Buffer.byteLength(text));
 assert.deepEqual(target.sizes[0],{cols:132,rows:42});c.ws.close();
});
test('invalid messages and oversized terminal input close the connection',async()=>{
 for(const [data,code] of [[{type:'resize',cols:0,rows:10},1008],[{type:'input',data:'x'.repeat(70000)},1009]]) {
  const s=await session();const c=open(s.session);await ready(c);c.ws.send(JSON.stringify(data));assert.equal(await c.closed,code);
 }
});
test('virtual machines keep their VNC ticket and RFB transport',async()=>{
 const s=await session(102);assert.equal(s.type,'vnc');assert.equal(s.password,'PVEVNC:abc');
 const c=open(s.session);await waitFor(()=>c.messages.length);assert.equal(c.messages[0].data.toString(),'RFB 003.008\n');
 assert.equal(stack.mock.consoleRequests.at(-1).type,'vnc');c.ws.close();
});
