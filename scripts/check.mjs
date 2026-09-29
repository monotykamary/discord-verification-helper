import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('extension/manifest.json', root), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
for (const key of ['host_permissions', 'optional_host_permissions', 'background', 'content_scripts', 'externally_connectable', 'web_accessible_resources']) {
  assert.equal(manifest[key], undefined, `Unexpected manifest capability: ${key}`);
}
assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'");
assert.equal(manifest.action.default_popup, 'popup.html');
const html = await readFile(new URL('extension/popup.html', root), 'utf8');
for (const ref of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])) {
  if (ref.startsWith('https://')) continue;
  assert(!ref.includes('..'));
  await readFile(new URL(`extension/${ref}`, root));
}
for (const dir of ['extension', 'scripts', 'tests']) {
  for (const file of await readdir(new URL(`${dir}/`, root))) {
    if (!/\.(?:m?js)$/.test(file)) continue;
    const checked = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`${dir}/${file}`, root))], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
  }
}
console.log('Manifest, version, permissions, popup assets, and JavaScript syntax checked.');
