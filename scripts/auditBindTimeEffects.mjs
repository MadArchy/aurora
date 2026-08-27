// T-010-401 support: find material side effects that execute at *bind time* or
// *render time* rather than inside an event handler — the legacy analogue of an
// effect during React render. Read-only.
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'src/main.ts';
const src = readFileSync(file, 'utf8');
const lines = src.split('\n');

const METHOD_RE = /^ {2}(?:private |public |protected )?(?:static )?(?:async )?([a-zA-Z_]+)\s*\(/;
const starts = [];
lines.forEach((line, i) => {
  if (METHOD_RE.test(line)) starts.push({ name: METHOD_RE.exec(line)[1], start: i });
});
const methods = starts.map((s, i) => ({
  ...s,
  end: i + 1 < starts.length ? starts[i + 1].start - 1 : lines.length - 1,
}));

const EFFECT = /(dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|import|seed|transition)[A-Za-z]*\()|(runSourceDiscoveryAgent|runTopicAgent|runResearchSignalsAgent|discoverExtendedSources|enrichYoutubeDiscoverySources|aiService\.[a-zA-Z]+\(|generatePositioningAdvice\(|proposeAngle\(|fetchSourceItems\(|pushCurrentLocalToFirestore\(|notifyClient\(|notifyManager\()/;

// A line that opens a deferred execution context: an event handler, a timer, a
// promise continuation, an array callback, or an async IIFE.
const DEFERRED_OPEN = /(addEventListener\(|setTimeout\(|setInterval\(|\.then\(|\.catch\(|\.finally\(|\.forEach\(|\.map\(|\.filter\(|\.find\(|\.some\(|\.every\(|\.reduce\(|\.sort\(|onChange\(|subscribe\(|=>\s*\{?\s*$|function\s*\()/;

const results = [];
for (const m of methods) {
  // Track brace depth relative to the method body, and whether we are currently
  // inside a deferred callback.
  let depth = 0;
  const deferredAt = []; // stack of depths at which a deferred context opened
  for (let i = m.start; i <= m.end; i += 1) {
    const line = lines[i];
    const code = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");

    const opensDeferred = DEFERRED_OPEN.test(code);
    const inDeferred = deferredAt.length > 0;

    if (EFFECT.test(code) && !inDeferred && i !== m.start) {
      results.push({
        method: m.name,
        line: i + 1,
        depth,
        text: line.trim().slice(0, 110),
      });
    }

    const opens = (code.match(/[{([]/g) || []).length;
    const closes = (code.match(/[})\]]/g) || []).length;
    if (opensDeferred) deferredAt.push(depth);
    depth += opens - closes;
    while (deferredAt.length > 0 && depth <= deferredAt[deferredAt.length - 1]) deferredAt.pop();
  }
}

console.log(`bind/render-time material effects in ${file}: ${results.length}\n`);
for (const r of results) console.log(`${String(r.line).padStart(5)}  ${r.method.padEnd(28)} ${r.text}`);

const byMethod = results.reduce((a, r) => { a[r.method] = (a[r.method] || 0) + 1; return a; }, {});
console.log('\nby method:', byMethod);
