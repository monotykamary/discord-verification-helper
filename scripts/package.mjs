import { cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await mkdir(join(root, '.tmp'), { recursive: true });
await mkdir(join(root, 'dist'), { recursive: true });
const staging = await mkdtemp(join(root, '.tmp', 'package-'));
const archive = join(root, 'dist', `discord-verification-helper-${pkg.version}.zip`);
const temporaryArchive = `${archive}.${process.pid}.tmp.zip`;
const files = ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'discord.js', 'adapters.js'];
try {
  for (const file of files) await cp(join(root, 'extension', file), join(staging, file));
  await cp(join(root, 'LICENSE'), join(staging, 'LICENSE'));
  const zipped = spawnSync('zip', ['-q', '-X', temporaryArchive, ...files, 'LICENSE'], { cwd: staging, encoding: 'utf8' });
  if (zipped.error || zipped.status !== 0) throw new Error(zipped.error?.message || zipped.stderr || 'zip failed');
  await rename(temporaryArchive, archive);
  console.log(archive);
} finally {
  await rm(staging, { recursive: true, force: true });
  await rm(temporaryArchive, { force: true });
}
