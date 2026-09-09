import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
process.loadEnvFile('.env.local');
await import('./check-production.mjs');
const port = process.env.PORT || '3000';
const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: process.env.CRM_BIND_HOST || '127.0.0.1', PORT: port, CRM_TEST_MODE: '0' };
// Bound the JS heap, not total RSS; monitor actual memory on the deployment host.
const app = spawn(process.execPath, ['--max-old-space-size=768', 'server.js'], { stdio: 'inherit', env });
const worker = spawn(process.execPath, ['--max-old-space-size=128', 'scripts/telegram-worker.mjs'], {
  stdio: 'inherit', env: { ...env, APP_URL: `http://127.0.0.1:${port}` },
});
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  app.kill('SIGTERM'); worker.kill('SIGTERM');
  process.exitCode = code;
}
app.on('exit', code => stop(code ?? 1));
worker.on('exit', code => stop(code || 1));
app.on('error', () => stop(1)); worker.on('error', () => stop(1));
process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
