/**
 * Provisiona usuarios Firebase Auth + custom claims POSTURA (producción).
 *
 * Requisitos:
 *   1. Service account JSON (Firebase Console → Project settings → Service accounts → Generate key)
 *   2. Variable de entorno:
 *        PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\firebase-sa.json"
 *   3. npm install
 *
 * Uso:
 *   npm run firebase:provision
 *   npm run firebase:provision -- --password "TuClaveSegura"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aurora-postura-app';
const ORG_ID = 'org_aurora_01';
const DEFAULT_PASSWORD = process.argv.includes('--password')
  ? process.argv[process.argv.indexOf('--password') + 1]
  : 'Postura2026!';

const USERS = [
  {
    email: 'manager@postura.internal',
    displayName: 'Santiago Morales (Brand Manager)',
    password: DEFAULT_PASSWORD,
    claims: { role: 'ADMIN', organizationId: ORG_ID, clientId: null },
  },
  {
    email: 'juan.vasquez@lexfirm.com',
    displayName: 'Juan J. Vasquez',
    password: DEFAULT_PASSWORD,
    claims: { role: 'CLIENT', organizationId: ORG_ID, clientId: 'client_juan_001' },
  },
];

function resolveCredentialPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve('secrets/firebase-sa.json'),
    resolve('.firebase-service-account.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function initAdmin() {
  if (getApps().length) return;

  const keyPath = resolveCredentialPath();
  if (!keyPath) {
    console.error(`
ERROR: faltan credenciales de Admin SDK.

1. Firebase Console → aurora-postura-app → ⚙ Project settings → Service accounts
2. "Generate new private key" → guarda como secrets/firebase-sa.json
3. PowerShell:
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\Users\\user\\Desktop\\AURORA\\secrets\\firebase-sa.json"
4. npm run firebase:provision
`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: PROJECT_ID,
  });
  console.log(`Credenciales: ${keyPath}\n`);
}

initAdmin();
const auth = getAuth();

async function upsertUser(def) {
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

  await auth.setCustomUserClaims(user.uid, def.claims);
  console.log(`  claims → role=${def.claims.role}${def.claims.clientId ? ` clientId=${def.claims.clientId}` : ''}`);
  return user.uid;
}

console.log(`Proyecto: ${PROJECT_ID}`);
console.log(`Provisionando ${USERS.length} usuarios…\n`);

for (const def of USERS) {
  await upsertUser(def);
}

console.log('\nListo. Despliega reglas si aún no lo hiciste:');
console.log('  npm run firebase:deploy:rules');
console.log('\nLuego inicia sesión en la app (VITE_FIREBASE_USE_EMULATORS=false).');
console.log('El primer login ADMIN bootstrappea Firestore si está vacío.');
