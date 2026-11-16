#!/usr/bin/python3
"""Root-owned SSH forced command. No general-purpose exec, mounts or shell.

Install on the Proxmox node, not inside the panel container. Read configuration
from /etc/pve-panel/ct-password-reset.json: {"pool": "customers"}.
The dedicated SSH key must use restrict, from= and a forced command.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import syslog


class Refused(Exception):
    def __init__(self, reason):
        self.reason = reason


def read_request(stream):
    raw = stream.read(2049)
    if len(raw) > 2048:
        raise Refused('invalid_request')
    try:
        request = json.loads(raw)
    except (ValueError, UnicodeError):
        raise Refused('invalid_request')
    if not isinstance(request, dict) or set(request) != {'vmid', 'password'}:
        raise Refused('invalid_request')
    vmid, password = request['vmid'], request['password']
    if type(vmid) is not int or not 100 <= vmid <= 999999999:
        raise Refused('invalid_request')
    if not isinstance(password, str) or not 12 <= len(password) <= 200:
        raise Refused('invalid_request')
    if any(ord(c) < 32 or ord(c) == 127 for c in password):
        raise Refused('invalid_request')
    return vmid, password


def run(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, timeout=10,
                          env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}, **kwargs)


def platform_json(path):
    result = run(['/usr/bin/pvesh', 'get', path, '--output-format', 'json'])
    if result.returncode:
        raise Refused('not_allowed')
    return json.loads(result.stdout)


def eligible(vmid, pool):
    node = socket.gethostname().split('.')[0]
    members = platform_json('/pools/' + pool).get('members', [])
    if not any(m.get('vmid') == vmid and m.get('type') == 'lxc' and m.get('node') == node for m in members):
        raise Refused('not_allowed')
    cfg = platform_json('/nodes/' + node + '/lxc/' + str(vmid) + '/config')
    if cfg.get('unprivileged') != 1 or cfg.get('template'):
        raise Refused('not_allowed')
    if cfg.get('lock'):
        raise Refused('locked')
    status = run(['/usr/sbin/pct', 'status', str(vmid)])
    if status.returncode or status.stdout.strip() != 'status: running':
        raise Refused('not_running')


def change_password(vmid, password, pool):
    eligible(vmid, pool)
    # Data goes only to stdin. The only executable runs inside the unprivileged
    # guest. Never interpret tenant input on the host or edit guest filesystem paths.
    result = run(['/usr/sbin/pct', 'exec', str(vmid), '--', '/usr/sbin/chpasswd'],
                 input='root:' + password + '\n')
    if result.returncode:
        raise Refused('reset_failed')


def main():
    vmid = None
    try:
        if os.geteuid() != 0 or os.environ.get('SSH_ORIGINAL_COMMAND') != 'reset-root-password-v1':
            raise Refused('not_allowed')
        cfg = json.loads(Path('/etc/pve-panel/ct-password-reset.json').read_text())
        pool = cfg.get('pool', '')
        if not isinstance(pool, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', pool):
            raise Refused('not_allowed')
        vmid, password = read_request(sys.stdin.buffer)
        directory = Path('/run/pve-panel-ct-reset')
        directory.mkdir(mode=0o700, exist_ok=True)
        with (directory / (str(vmid) + '.lock')).open('w') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Refused('busy')
            change_password(vmid, password, pool)
        syslog.syslog(syslog.LOG_AUTHPRIV | syslog.LOG_NOTICE, 'pve-panel root password changed for CT ' + str(vmid))
        print(json.dumps({'changed': True}))
        return 0
    except Refused as exc:
        print(json.dumps({'error': exc.reason}))
        return 1
    except Exception:
        # Do not print exceptions, subprocess output or input data.
        print(json.dumps({'error': 'reset_failed'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
