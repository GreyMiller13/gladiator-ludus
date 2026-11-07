// Package only runtime files. No bundler or runtime npm dependencies are needed.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, '_site');
// Fixed deletion target inside the repository, never user input.
if (path.dirname(out) !== path.resolve(root)) throw new Error('Invalid output path');
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const dir of ['css', 'js', 'assets']) await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
for (const name of await readdir(path.join(out, 'js'))) {
  if (name.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(out, 'js', name)]);
}
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^\"]*)?"/g)];
for (const [full, asset] of refs) {
  const contents = await readFile(path.join(out, asset));
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12);
  html = html.replace(full, full.replace(/="[^"]+"/, `="${asset}?v=${hash}"`));
}
await writeFile(path.join(out, 'index.html'), html);
await writeFile(path.join(out, '.nojekyll'), '');
const revision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
await writeFile(path.join(out, 'build-info.json'), JSON.stringify({ revision }, null, 2) + '\n');
console.log(`Ready: _site (HTML, ${refs.length} scripts/styles, assets). Revision: ${revision}`);
