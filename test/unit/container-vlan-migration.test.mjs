import '../support/unit-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const seed = new DatabaseSync(process.env.DB_PATH);
seed.exec(`CREATE TABLE ct_templates (
 id INTEGER PRIMARY KEY AUTOINCREMENT, volid TEXT NOT NULL, node TEXT NOT NULL,
 label TEXT NOT NULL, storage TEXT NOT NULL, min_disk_gb INTEGER NOT NULL DEFAULT 4,
 bridge TEXT NOT NULL DEFAULT 'vmbr0', nesting INTEGER NOT NULL DEFAULT 1,
 UNIQUE (volid, node));
 INSERT INTO ct_templates (volid,node,label,storage) VALUES ('local:vztmpl/debian.tar.zst','pve1','Existing','vmdata');`);
seed.close();
const { db } = await import('../../src/db.js');

test('existing LXC catalog migrates without changing its storage or adding a VLAN', () => {
 const row = db.prepare('SELECT * FROM ct_templates').get();
 assert.equal(row.storage, 'vmdata');
 assert.equal(row.bridge, 'vmbr0');
 assert.equal(row.vlan_tag, null);
 assert.throws(() => db.prepare('UPDATE ct_templates SET vlan_tag=4095').run());
 db.prepare('UPDATE ct_templates SET vlan_tag=901').run();
 const child = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', "const {db}=await import('./src/db.js'); if(db.prepare('SELECT vlan_tag FROM ct_templates').get().vlan_tag!==901) process.exit(2); db.close();"], { env: process.env, encoding: 'utf8' });
 assert.equal(child.status, 0, child.stderr);
 assert.equal(db.prepare('SELECT count(*) AS n FROM ct_templates').get().n, 1);
 db.close();
});
