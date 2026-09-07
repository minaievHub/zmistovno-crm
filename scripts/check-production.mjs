import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const missing = [];
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_URL']) {
  if (!process.env[key] || /YOUR_|CHANGE_ME/.test(process.env[key])) missing.push(key);
}
if (process.env.CRM_TEST_MODE === '1') missing.push('Remove CRM_TEST_MODE (demo is forbidden)');
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'APP_URL']) {
  try { if (!['http:', 'https:'].includes(new URL(process.env[key]).protocol)) throw new Error(); }
  catch { if (!missing.includes(key)) missing.push(key + ' (valid URL required)'); }
}
if (missing.length) {
  console.error('Production configuration incomplete:\n- ' + missing.join('\n- '));
  console.error('Fill .env.local; see docs/PRODUCTION.md. No secrets were printed.');
  process.exit(1);
}
const telegram = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_ENCRYPTION_KEY', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET'].filter(k => !process.env[k]);
if (process.env.TELEGRAM_ENCRYPTION_KEY && Buffer.from(process.env.TELEGRAM_ENCRYPTION_KEY, 'base64').length !== 32) {
  console.error('TELEGRAM_ENCRYPTION_KEY must decode to 32 bytes.'); process.exit(1);
}
console.log('CRM configuration present. This check does not verify migrations or remote access.');
if (telegram.length) console.log('Telegram setup incomplete: ' + telegram.join(', '));
else console.log('Telegram configuration present; authorize the account in CRM settings.');
