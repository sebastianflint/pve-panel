// Settings for unit tests that import panel modules directly. Must be imported
// FIRST in a test file (module evaluation follows import order).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pve-panel-unit-'));
process.env.DOTENV_CONFIG_PATH = path.join(dir, 'no-such.env');
process.env.JWT_SECRET ??= 'unit-test-secret-unit-test-secret';
process.env.PVE_URL ??= 'http://127.0.0.1:9';
process.env.PVE_TOKEN_ID ??= 'panel@pve!panel';
process.env.PVE_TOKEN_SECRET ??= 'x';
process.env.DB_PATH = path.join(dir, 'unit.db');
process.env.UPDATE_CHECK = 'false';
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
