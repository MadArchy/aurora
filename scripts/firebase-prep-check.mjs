/**
 * Verifica que la máquina está lista para modo Firebase (producción nube).
 * Uso: npm run firebase:prep
 *
 * SEC-009-012: service account must be OUTSIDE the repository clone.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env.local');

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const OPTIONAL_ENV = [
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_USE_EMULATORS',
];

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function check(name, ok, detail = '') {
  console.log(`${ok ? '[OK]' : '[ ]'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function isPathInsideRepo(absPath) {
  const repo = normalize(root).toLowerCase();
  const target = normalize(resolve(absPath)).toLowerCase();
  return target === repo || target.startsWith(repo + '\\') || target.startsWith(repo + '/');
}

console.log('\nPOSTURA — Preparación Firebase (aurora-postura-app)\n');

const checks = [];

checks.push(check('.env.local existe', existsSync(envPath), envPath));

const env = parseEnvFile(envPath) || {};
for (const key of REQUIRED_ENV) {
  const val = env[key];
  checks.push(check(`${key}`, Boolean(val && val.length > 0)));
}

const useEmulators = env.VITE_FIREBASE_USE_EMULATORS === 'true';
checks.push(
  check(
    'Modo nube (no emulador)',
    !useEmulators,
    useEmulators ? 'VITE_FIREBASE_USE_EMULATORS=true — cámbialo a false para piloto' : undefined
  )
);

const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
if (projectId && projectId !== 'aurora-postura-app') {
  checks.push(check('Proyecto esperado', true, `usando ${projectId} (distinto de aurora-postura-app)`));
} else if (projectId) {
  checks.push(check('Proyecto aurora-postura-app', true));
}

for (const key of OPTIONAL_ENV) {
  if (env[key]) checks.push(check(`${key} (opcional)`, true));
}

const saEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const inRepoSaCandidates = [
  resolve(root, 'secrets/firebase-sa.json'),
  resolve(root, '.firebase-service-account.json'),
];
const inRepoSaPresent = inRepoSaCandidates.filter((p) => existsSync(p));

if (inRepoSaPresent.length) {
  checks.push(
    check(
      'Service account NOT inside repo tree',
      false,
      `found under clone (move outside): ${inRepoSaPresent.map((p) => p.replace(root, '.')).join(', ')}`
    )
  );
} else {
  checks.push(check('Service account NOT inside repo tree', true, 'no in-repo SA file detected'));
}

if (!saEnv) {
  checks.push(
    check(
      'GOOGLE_APPLICATION_CREDENTIALS (external)',
      false,
      'set to a path OUTSIDE the clone, e.g. %USERPROFILE%\\.firebase-credentials\\firebase-sa.json'
    )
  );
} else {
  const abs = resolve(saEnv);
  const exists = existsSync(abs);
  const inside = isPathInsideRepo(abs);
  if (!exists) {
    checks.push(check('GOOGLE_APPLICATION_CREDENTIALS file exists', false, abs));
  } else if (inside) {
    checks.push(
      check(
        'GOOGLE_APPLICATION_CREDENTIALS outside repo',
        false,
        `path is inside clone — move SA outside and update env`
      )
    );
  } else {
    checks.push(check('GOOGLE_APPLICATION_CREDENTIALS outside repo', true, '(path omitted)'));
  }
}

const firebaseRc = existsSync(resolve(root, 'firebase.json'));
checks.push(check('firebase.json', firebaseRc));

const rules = existsSync(resolve(root, 'firestore.rules'));
checks.push(check('firestore.rules', rules));

const storageRules = existsSync(resolve(root, 'storage.rules'));
checks.push(check('storage.rules', storageRules));

let cliOk = false;
try {
  const r = spawnSync('firebase', ['--version'], {
    encoding: 'utf8',
    shell: true,
    timeout: 8000,
  });
  cliOk = r.status === 0 && !r.error;
  if (cliOk) {
    checks.push(check('Firebase CLI', true, (r.stdout || r.stderr || '').trim().split('\n')[0]));
  } else if (r.error?.code === 'ETIMEDOUT') {
    checks.push(check('Firebase CLI', false, 'timeout — prueba npx firebase --version'));
  } else {
    checks.push(check('Firebase CLI', false, 'npm install -g firebase-tools o usa npx firebase'));
  }
} catch {
  checks.push(check('Firebase CLI', false, 'npm install firebase-tools -g o npx firebase'));
}

console.log('\nPasos siguientes (orden recomendado):\n');
console.log('1. Console → Auth Email/Password + dominios 127.0.0.1 y localhost');
console.log('2. Console → Storage → Get Started');
console.log('3. Deploy rules solo cuando Spec autorice (CODE_COMPLETE → DEPLOYED)');
console.log('4. SA fuera del clone: $env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\\.firebase-credentials\\firebase-sa.json"');
console.log('5. npm run firebase:provision  (tras claims: re-login / token refresh)');
console.log('6. Reiniciar npm run dev → badge «Firebase · aurora-postura-app»');
console.log('7. Login manager → bootstrap seed si Firestore vacío');
console.log('8. npm run checklist:pilot — recorrido manual DoD §7\n');

const allOk = checks.every(Boolean);
console.log(allOk ? 'Listo para activar Firebase en esta máquina.' : 'Completa los ítems marcados [ ] antes del piloto multiusuario.');
console.log('Guía completa: docs/ops/firebase.md\n');

process.exit(allOk ? 0 : 1);
