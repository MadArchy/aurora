// T-010-401 support: per-handler side-effect ordering for the legacy controller.
// A `bind*` method attaches many handlers; ordering is a property of each handler,
// not of the method, so this walks handler bodies individually. Read-only.
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'src/main.ts';
const lines = readFileSync(file, 'utf8').split('\n');

const EFFECT = /(dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|import|seed|transition)[A-Za-z]*\()|runSourceDiscoveryAgent|runTopicAgent|runResearchSignalsAgent|discoverExtendedSources|enrichYoutubeDiscoverySources|aiService\.[a-zA-Z]+\(|generatePositioningAdvice\(|proposeAngle\(|fetchSourceItems\(|pushCurrentLocalToFirestore\(|notifyClient\(|notifyManager\(|persistRecording\(|saveRecording\(/;

// Anything that can stop the path before the effect runs.
const GATE = /(if \(!|if \(.*\)\s*(return|throw)|return;|return false|return true|throw |assert[A-Z]|validate[A-Z]|authorize[A-Z]|gate[A-Z]|confirm\(|\.ok\b|\.ready\b|\.authorized\b|canSubmit|blocked|denial|=== '|!== '|\?\.)/;

const HANDLER_OPEN = /addEventListener\(\s*'[^']+'\s*,\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{?/;

const handlers = [];
for (let i = 0; i < lines.length; i += 1) {
  if (!HANDLER_OPEN.test(lines[i])) continue;
  // Walk forward to the end of the handler by brace balance.
  let depth = 0;
  let started = false;
  let end = i;
  for (let j = i; j < lines.length; j += 1) {
    const code = lines[j].replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    if (opens > 0) started = true;
    depth += opens - closes;
    if (started && depth <= 0) { end = j; break; }
    end = j;
  }
  handlers.push({ start: i + 1, end: end + 1, body: lines.slice(i, end + 1) });
}

let gateFirst = 0;
let effectFirst = 0;
let noEffect = 0;
const offenders = [];

for (const h of handlers) {
  let firstEffect = -1;
  let firstGate = -1;
  h.body.forEach((line, idx) => {
    const code = line.replace(/\/\/.*$/, '');
    if (firstEffect === -1 && EFFECT.test(code)) firstEffect = idx;
    if (firstGate === -1 && GATE.test(code)) firstGate = idx;
  });
  if (firstEffect === -1) { noEffect += 1; continue; }
  if (firstGate !== -1 && firstGate <= firstEffect) { gateFirst += 1; continue; }
  effectFirst += 1;
  offenders.push({ line: h.start + firstEffect, text: h.body[firstEffect].trim().slice(0, 100) });
}

console.log(`handlers found: ${handlers.length}`);
console.log(`  NO_EFFECT   : ${noEffect}`);
console.log(`  GATE_FIRST  : ${gateFirst}`);
console.log(`  EFFECT_FIRST: ${effectFirst}`);
if (offenders.length) {
  console.log('\nEFFECT_FIRST handler sites:');
  for (const o of offenders) console.log(`  ${String(o.line).padStart(5)}  ${o.text}`);
}
