/**
 * Checklist operativo para Cloud Functions (no lee ni sube secretos).
 * Uso: node scripts/deploy-functions-checklist.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env.local');
const built = existsSync(resolve(root, 'functions/lib/index.js'));

function hasEnvKey(name) {
  if (!existsSync(envPath)) return false;
  const text = readFileSync(envPath, 'utf8');
  return new RegExp(`^${name}=.+$`, 'm').test(text);
}

const checks = [
  { ok: existsSync(resolve(root, 'functions/package.json')), label: 'Carpeta functions/' },
  { ok: existsSync(resolve(root, 'functions/node_modules')), label: 'npm install en functions/' },
  { ok: built, label: 'Build functions (lib/index.js)' },
  { ok: hasEnvKey('TAVILY_API_KEY'), label: 'TAVILY_API_KEY en .env.local (local)' },
  { ok: hasEnvKey('YOUTUBE_API_KEY'), label: 'YOUTUBE_API_KEY en .env.local (local)' },
  { ok: true, label: 'Proxies cloud requieren Bearer Firebase + role ADMIN (ver docs/ops/firebase.md)' },
];

console.log('\nAURORA — checklist deploy Cloud Functions\n');
for (const c of checks) {
  console.log(`${c.ok ? '[OK]' : '[ ]'} ${c.label}`);
}

console.log(`
Siguiente (ejecutar tú en PowerShell — requiere tu aprobación):

  cd C:\\Users\\user\\Desktop\\AURORA

  # 1) Secretos en Firebase Secret Manager
  ($m = Select-String -Path .env.local -Pattern '^TAVILY_API_KEY=(.+)$')
  if ($m) { $m.Matches[0].Groups[1].Value | npx firebase functions:secrets:set TAVILY_API_KEY }

  ($m = Select-String -Path .env.local -Pattern '^YOUTUBE_API_KEY=(.+)$')
  if ($m) { $m.Matches[0].Groups[1].Value | npx firebase functions:secrets:set YOUTUBE_API_KEY }

  # 2) Deploy
  npm run firebase:deploy:functions
  npx firebase deploy --only firestore:indexes

  # 3) Hosting (opcional) con base de functions
  # $env:VITE_POSTURA_FUNCTIONS_BASE="https://us-central1-aurora-postura-app.cloudfunctions.net"
  # npm run firebase:deploy:hosting
`);
