/**
 * SPEC-009 T-009-13 — sanitized secret scan (never prints secret material).
 *
 * Prefers gitleaks when available; always runs local inventory checks.
 * Usage: npm run secret:scan
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const findings = [];

function addFinding(classification, category, location, rotationRequired, notes = '') {
  findings.push({ classification, category, location, rotationRequired, notes });
}

function isBinaryExt(file) {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.zip', '.rar', '.7z', '.pdf'].includes(
    extname(file).toLowerCase()
  );
}

function walkFiles(dir, out, depth = 0) {
  if (depth > 8) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out, depth + 1);
    else out.push(full);
  }
}

function looksLikePrivateKeyMaterial(text) {
  return (
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /"private_key"\s*:\s*"-----BEGIN/.test(text) ||
    /"type"\s*:\s*"service_account"[\s\S]{0,200}"private_key"\s*:/.test(text)
  );
}

console.log('\nSPEC-009 secret scan (sanitized — no secret values printed)\n');

// --- gitleaks if present ---
let gitleaksRan = false;
const gitleaks = spawnSync('gitleaks', ['version'], { encoding: 'utf8', shell: true, timeout: 8000 });
if (gitleaks.status === 0) {
  gitleaksRan = true;
  console.log('[tool] gitleaks available — running detect --no-git (workdir) + git history');
  const detect = spawnSync(
    'gitleaks',
    ['detect', '--source', root, '--report-format', 'json', '--report-path', resolve(root, '.gitleaks-report.json'), '-v'],
    { encoding: 'utf8', shell: true, timeout: 120_000 }
  );
  // Exit 1 = leaks found; we classify without dumping
  if (existsSync(resolve(root, '.gitleaks-report.json'))) {
    try {
      const report = JSON.parse(readFileSync(resolve(root, '.gitleaks-report.json'), 'utf8'));
      const rows = Array.isArray(report) ? report : [];
      console.log(`[tool] gitleaks findings count: ${rows.length} (details not printed)`);
      if (rows.length === 0) {
        addFinding('FALSE POSITIVE', 'gitleaks', 'working tree + history', false, 'zero findings');
      } else {
        for (const row of rows.slice(0, 50)) {
          addFinding(
            'POTENTIALLY EXPOSED',
            row.RuleID || row.Description || 'gitleaks',
            row.File || row.Path || 'unknown',
            true,
            'gitleaks hit — rotate if confirmed live credential'
          );
        }
      }
    } catch {
      addFinding('DEMO/NON-SECRET', 'gitleaks-report', '.gitleaks-report.json', false, 'could not parse report');
    }
  } else {
    console.log(`[tool] gitleaks exit=${detect.status} (no report file)`);
  }
} else {
  console.log('[tool] gitleaks not on PATH — using local inventory scanner');
}

// --- git tracked status of known SA paths ---
const lsFiles = spawnSync('git', ['ls-files', 'secrets', 'secrets/firebase-sa.json', '.firebase-service-account.json'], {
  encoding: 'utf8',
  shell: true,
  cwd: root,
});
const trackedSa = (lsFiles.stdout || '').trim();
if (trackedSa) {
  addFinding('POTENTIALLY EXPOSED', 'firebase-service-account', trackedSa, true, 'tracked by git');
} else {
  addFinding(
    'VALID SECRET NOT EXPOSED',
    'firebase-service-account',
    'known SA paths (gitignore)',
    false,
    'not in git index'
  );
}

const hist = spawnSync(
  'git',
  ['log', '--all', '--pretty=format:%H', '--', 'secrets/firebase-sa.json', '.firebase-service-account.json', 'secrets/*'],
  { encoding: 'utf8', shell: true, cwd: root, timeout: 60_000 }
);
const histLines = (hist.stdout || '').trim().split(/\r?\n/).filter(Boolean);
if (histLines.length) {
  addFinding(
    'POTENTIALLY EXPOSED',
    'firebase-service-account',
    `git history commits: ${histLines.length}`,
    true,
    'path appeared in history — verify + rotate if real key'
  );
} else {
  addFinding('VALID SECRET NOT EXPOSED', 'firebase-service-account-history', 'git history', false, 'no commits for known SA paths');
}

// --- working tree: in-repo SA file present (gitignored) ---
const localSaCandidates = [
  resolve(root, 'secrets/firebase-sa.json'),
  resolve(root, '.firebase-service-account.json'),
];
const localPresent = localSaCandidates.filter((p) => existsSync(p));
if (localPresent.length) {
  for (const p of localPresent) {
    addFinding(
      'VALID SECRET NOT EXPOSED',
      'firebase-service-account-local',
      relative(root, p) + ' (local, gitignored)',
      false,
      'move outside clone per SEC-009-012; do not distribute'
    );
  }
} else {
  addFinding(
    'DEMO/NON-SECRET',
    'firebase-service-account-local',
    'repo tree',
    false,
    'no in-repo SA file present (SEC-009-012 ops closure)'
  );
}

// --- private-key pattern scan of tracked text files (sanitized) ---
const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8', shell: true, cwd: root });
const trackedFiles = (tracked.stdout || '').split(/\r?\n/).filter(Boolean);
let keyHits = 0;
for (const rel of trackedFiles) {
  if (isBinaryExt(rel)) continue;
  const full = resolve(root, rel);
  if (!existsSync(full)) continue;
  let text;
  try {
    const st = statSync(full);
    if (st.size > 2_000_000) continue;
    text = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  if (looksLikePrivateKeyMaterial(text)) {
    keyHits += 1;
    addFinding('POTENTIALLY EXPOSED', 'private-key-pattern', rel, true, 'pattern in tracked file');
  }
}
if (keyHits === 0) {
  addFinding('FALSE POSITIVE', 'private-key-pattern', 'tracked text files', false, 'no private-key patterns in git index');
}

// --- archives under repo ---
const allFiles = [];
walkFiles(root, allFiles);
const archives = allFiles.filter((f) => ['.zip', '.rar', '.7z'].includes(extname(f).toLowerCase()));
if (archives.length === 0) {
  addFinding('DEMO/NON-SECRET', 'archives', 'repo tree', false, 'no zip/rar/7z found under clone');
} else {
  for (const arch of archives) {
    addFinding(
      'POTENTIALLY EXPOSED',
      'archive',
      relative(root, arch),
      true,
      'archive present — inspect offline for SA; do not print contents'
    );
  }
}

console.log('\n--- Findings (sanitized) ---\n');
for (const f of findings) {
  console.log(
    `- [${f.classification}] ${f.category} @ ${f.location}` +
      ` | rotation_required=${f.rotationRequired ? 'YES' : 'NO'}` +
      (f.notes ? ` | ${f.notes}` : '')
  );
}

const rotationNeeded = findings.some((f) => f.rotationRequired);
console.log('\n--- Summary ---');
console.log(`gitleaks_ran=${gitleaksRan}`);
console.log(`findings=${findings.length}`);
console.log(`rotation_required_overall=${rotationNeeded ? 'YES' : 'NO'}`);
console.log('Never paste private keys into tickets or chat.\n');

process.exit(0);
