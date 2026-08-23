/**
 * Provisiona usuarios Firebase Auth + custom claims POSTURA (producción).
 *
 * Requisitos:
 *   1. Service account JSON — OUTSIDE the repository clone (SEC-009-012)
 *   2. Variable de entorno:
 *        PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\<you>\.firebase-credentials\firebase-sa.json"
 *   3. npm install
 *
 * Uso:
 *   npm run firebase:provision
 *   npm run firebase:provision -- --password "TuClaveSegura"
 *
 * Claims (fail-closed, no default tenant):
 *   ADMIN  → role, organizationId required, clientId null
 *   CLIENT → role, organizationId required, clientId required
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aurora-postura-app';
/** Explicit demo fixture org for seed users — never used as silent fallback. */
const DEMO_ORG_ID = 'org_aurora_01';
const DEFAULT_PASSWORD = process.argv.includes('--password')
  ? process.argv[process.argv.indexOf('--password') + 1]
  : 'Postura2026!';
const REPO_ROOT = resolve(process.cwd());

const USERS = [
  {
    email: 'manager@postura.internal',
    displayName: 'Santiago Morales (Brand Manager)',
    password: DEFAULT_PASSWORD,
    claims: { role: 'ADMIN', organizationId: DEMO_ORG_ID, clientId: null },
  },
  {
    email: 'juan.vasquez@lexfirm.com',
    displayName: 'Juan J. Vasquez',
    password: DEFAULT_PASSWORD,
    claims: { role: 'CLIENT', organizationId: DEMO_ORG_ID, clientId: 'client_juan_001' },
  },
  {
    email: 'elena.martinez@lexfirm.com',
    displayName: 'Elena Martínez',
    password: DEFAULT_PASSWORD,
    claims: { role: 'CLIENT', organizationId: DEMO_ORG_ID, clientId: 'client_elena_002' },
  },
];

function nonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required (no default tenant)`);
  }
  return value.trim();
}

/** Fail-closed claim validation before setCustomUserClaims. */
function validateClaims(claims) {
  const role = claims?.role;
  if (role !== 'ADMIN' && role !== 'CLIENT') {
    throw new Error('role must be ADMIN or CLIENT');
  }
  const organizationId = nonEmpty(claims.organizationId, 'organizationId');
  if (role === 'ADMIN') {
    return { role: 'ADMIN', organizationId, clientId: null };
  }
  const clientId = nonEmpty(claims.clientId, 'clientId');
  return { role: 'CLIENT', organizationId, clientId };
}

function isPathInsideRepo(absPath) {
  const root = normalize(REPO_ROOT).toLowerCase();
  const target = normalize(resolve(absPath)).toLowerCase();
  return target === root || target.startsWith(root + '\\') || target.startsWith(root + '/');
}

function resolveCredentialPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!fromEnv) return null;
  const abs = resolve(fromEnv);
  if (!existsSync(abs)) {
    console.error(`ERROR: GOOGLE_APPLICATION_CREDENTIALS points to missing file:\n  ${abs}`);
    process.exit(1);
  }
  if (isPathInsideRepo(abs)) {
    console.error(`
ERROR: Service account path is inside the repository clone (SEC-009-012).

  Path: ${abs}
  Repo: ${REPO_ROOT}

Move the JSON outside the clone (e.g. %USERPROFILE%\\.firebase-credentials\\firebase-sa.json)
and set GOOGLE_APPLICATION_CREDENTIALS to that external path.
Do not use AURORA/secrets/ or any path under the repo.
`);
    process.exit(1);
  }
  return abs;
}

function initAdmin() {
  if (getApps().length) return;

  const keyPath = resolveCredentialPath();
  if (!keyPath) {
    console.error(`
ERROR: faltan credenciales de Admin SDK (path externo al repo).

1. Firebase Console → aurora-postura-app → Project settings → Service accounts
2. "Generate new private key" → guarda FUERA del clone, p. ej.:
     %USERPROFILE%\\.firebase-credentials\\firebase-sa.json
3. PowerShell:
   $env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\\.firebase-credentials\\firebase-sa.json"
4. npm run firebase:provision

In-repo paths (secrets/, .firebase-service-account.json) are rejected.
`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: PROJECT_ID,
  });
  console.log(`Credenciales (externas): ${keyPath}\n`);
}

initAdmin();
const auth = getAuth();

async function upsertUser(def) {
  const claims = validateClaims(def.claims);
  let user;
  try {
    user = await auth.getUserByEmail(def.email);
    await auth.updateUser(user.uid, {
      password: def.password,
      displayName: def.displayName,
      emailVerified: true,
    });
    console.log(`✓ Actualizado: ${def.email} (${user.uid})`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    user = await auth.createUser({
      email: def.email,
      password: def.password,
      displayName: def.displayName,
      emailVerified: true,
    });
    console.log(`✓ Creado: ${def.email} (${user.uid})`);
  }

  await auth.setCustomUserClaims(user.uid, claims);
  console.log(
    `  claims → role=${claims.role} organizationId=${claims.organizationId}` +
      (claims.clientId ? ` clientId=${claims.clientId}` : ' clientId=null')
  );
  return user.uid;
}

console.log(`Proyecto: ${PROJECT_ID}`);
console.log(`Provisionando ${USERS.length} usuarios…\n`);

for (const def of USERS) {
  await upsertUser(def);
}

console.log('\nListo. Tras cambiar claims, usuarios deben re-login o forzar refresh del ID token.');
console.log('Despliega reglas solo cuando el Spec autorice deploy (no en Phase 4).');
