import { cp, mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
// Package into a fresh directory; never copy local environment files from tracing.
const target = path.resolve(process.argv[2] || 'server-package');
try { await access(target); throw new Error('Output directory already exists; choose a fresh path'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await access('.next/standalone/server.js');
await mkdir(target, { recursive: true });
await cp('.next/standalone', target, { recursive: true, filter: (source) => !path.basename(source).startsWith('.env') });
await cp('.next/static', path.join(target, '.next/static'), { recursive: true });
try { await access('public'); await cp('public', path.join(target, 'public'), { recursive: true }); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(path.join(target, 'scripts'), { recursive: true });
for (const file of ['run-server.mjs', 'telegram-worker.mjs', 'check-production.mjs'])
  await cp('scripts/' + file, path.join(target, 'scripts', file));
await cp('.env.example', path.join(target, '.env.example'));
await cp('docs/SERVER.md', path.join(target, 'SERVER.md'));
await writeFile(path.join(target, 'BUILD-INFO.json'), JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, commit: process.env.GITHUB_SHA || 'local' }, null, 2));
console.log('Server package ready: ' + target);
