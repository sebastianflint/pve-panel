// Guest agent helper against the simulated Proxmox: stalls, lost results.
import '../support/unit-env.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startMockPve } from '../support/mock-pve.mjs';

let mock;
let agentExec;
let AgentResultLost;
const VM = '/nodes/pve1/qemu/102';           // a running VM in the mock
const STATUS = ['/bin/bash', '-c', 'tailscale status --json'];

before(async () => {
  mock = await startMockPve();
  process.env.PVE_URL = mock.url;              // read when config.js loads
  ({ agentExec, AgentResultLost } = await import('../../src/agent.js'));
});
after(() => mock.close());

test('returns output and exit code', async () => {
  const r = await agentExec(VM, STATUS, 20_000);
  assert.equal(r.code, 0);
  assert.match(r.out, /BackendState/);
});

test('waits out short guest agent stalls ("got timeout")', async () => {
  await mock.control('/__flaky/102/3');
  const r = await agentExec(VM, STATUS, 30_000);
  assert.equal(r.code, 0);
});

test('reruns a safe command once when the agent lost its result ("PID lld does not exist")', async () => {
  await mock.control('/__lose/102/1');
  const r = await agentExec(VM, STATUS, 30_000);
  assert.equal(r.code, 0);
});

test('one-shot commands report the lost result instead of running twice', async () => {
  await mock.control('/__lose/102/1');
  await assert.rejects(agentExec(VM, STATUS, 30_000, undefined, { retryIfLost: false }), AgentResultLost);
});
