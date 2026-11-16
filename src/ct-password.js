import { spawn } from 'node:child_process';
import { config } from './config.js';

const active = new Set();
const problem = (statusCode, message) => Object.assign(new Error(message), { statusCode, expose: true });

export function ctPasswordResetAvailable(guest) {
  return config.ctPasswordReset.enabled && guest.type === 'lxc' && guest.node === config.ctPasswordReset.node;
}

export async function resetCtRootPassword(guest, password) {
  if (!ctPasswordResetAvailable(guest)) throw problem(503, 'Root password recovery is not configured on this node');
  if (active.has(guest.vmid)) throw problem(409, 'A password change is already in progress');
  active.add(guest.vmid);
  try {
    const c = config.ctPasswordReset;
    // No shell and no password in argv, environment, errors or returned data.
    const args = ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
      '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${c.knownHostsFile}`,
      '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'ClearAllForwardings=yes',
      '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no',
      '-o', 'ConnectTimeout=5', '-o', 'ConnectionAttempts=1', '-o', 'LogLevel=ERROR',
      '-i', c.keyFile, '--', `root@${c.host}`, 'reset-root-password-v1'];
    await new Promise((resolve, reject) => {
      const child = spawn(c.sshBin, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let output = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
      child.stdout.on('data', (b) => {
        output += b.toString();
        if (output.length > 1024) child.kill('SIGKILL');
      });
      child.stderr.resume(); // Never forward helper or guest diagnostics (may contain secrets).
      child.stdin.on('error', () => {}); // close/error handles a refused connection or early exit.
      child.once('error', () => {
        clearTimeout(timer);
        reject(problem(502, 'The password recovery service could not be reached'));
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        let result;
        try { result = JSON.parse(output); } catch { /* fail closed */ }
        if (code === 0 && result?.changed === true) return resolve();
        const reasons = {
          not_running: 'Start the container before changing its root password',
          not_allowed: 'This container is not eligible for password recovery',
          locked: 'Wait for the current server operation to finish',
          busy: 'A password change is already in progress',
        };
        reject(problem(result?.error in reasons ? 409 : 502,
          reasons[result?.error] || 'The root password change could not be confirmed. Try again or contact your provider.'));
      });
      child.stdin.end(JSON.stringify({ vmid: guest.vmid, password }));
    });
  } finally {
    active.delete(guest.vmid);
  }
}
