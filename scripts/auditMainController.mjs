// T-010-401 support: mechanical responsibility + side-effect-ordering inventory
// for the legacy `main.ts` controller. Read-only; prints a table to stdout.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/main.ts', 'utf8');
const lines = src.split('\n');

const METHOD_RE = /^ {2}(?:private |public |protected )?(?:static )?(?:async )?([a-zA-Z_]+)\s*\(/;

const starts = [];
lines.forEach((line, i) => {
  const m = METHOD_RE.exec(line);
  if (m) starts.push({ name: m[1], start: i + 1 });
});

const methods = starts.map((s, i) => ({
  ...s,
  end: i + 1 < starts.length ? starts[i + 1].start - 1 : lines.length,
}));

// Signals we classify on.
const PROBES = {
  dbWrite: /dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|import|seed|log)[A-Za-z]*\(/g,
  dbRead: /dbService\.(get|list|find|read|is|has|count|query)[A-Za-z]*\(/g,
  canonical: /(strategicRouting\.|opportunityScoutConsumer|learningLoopConsumer|strategicBriefConsumer|authorizeContentPublicationGate|createStrategicSignalRoutingUseCases|registerSignalOutcomeIntent|registerResultRecordIntent)/g,
  dom: /(document\.|querySelector|getElementById|innerHTML|addEventListener|classList|\.value\b)/g,
  render: /this\.(render|refreshMain|renderMainView|renderToasts|renderActiveModal)\(/g,
  uiState: /this\.(activeTab|activeClientId|activeCampaignId|activeModal|modalData|filterState|toasts|loginError)\b/g,
  agent: /(runSourceDiscoveryAgent|runTopicAgent|runResearchSignalsAgent|discoverExtendedSources|enrichYoutubeDiscoverySources|aiService\.|generatePositioningAdvice|proposeAngle|fetchSourceItems|pollOneSource)/g,
  notify: /(notifyClient|notifyManager|notificationService\.|showToast)/g,
  net: /(fetch\(|firestore|pushCurrentLocalToFirestore|mediaDevices|MediaRecorder)/g,
  timer: /(setInterval|setTimeout|clearInterval|clearTimeout)/g,
  guard: /(if \(!|return;|throw |assert|validate|gate|canSubmit|authorize|confirm\()/g,
};

const count = (body, re) => (body.match(re) || []).length;

const rows = methods.map((m) => {
  const body = lines.slice(m.start - 1, m.end).join('\n');
  const p = Object.fromEntries(Object.entries(PROBES).map(([k, re]) => [k, count(body, re)]));

  // Responsibility classification, most-authoritative signal first.
  let cls;
  if (p.dbWrite > 0) cls = 'LEGACY_BUSINESS_WRITE';
  else if (p.canonical > 0) cls = 'CANONICAL_COMMAND_INVOCATION';
  else if (p.agent > 0) cls = 'AI_OR_AGENT_TRIGGER';
  else if (p.net > 0) cls = 'SIDE_EFFECT';
  else if (p.notify > 0) cls = 'NOTIFICATION';
  else if (p.timer > 0) cls = 'SIDE_EFFECT';
  else if (/^(render|renderMainView|renderToasts|renderActiveModal|renderNotificationsPanel|refreshMain)$/.test(m.name)) cls = 'RENDER_ORCHESTRATION';
  else if (/^bind/.test(m.name)) cls = 'EVENT_WIRING';
  else if (/^(setTab|enterClient|backToPortfolio|navigateFromNotification|openModal|closeModal|setActiveCampaign)$/.test(m.name)) cls = 'NAVIGATION';
  else if (p.uiState > 0) cls = 'UI_STATE';
  else if (p.dom > 0) cls = 'DOM_MANIPULATION';
  else if (p.dbRead > 0) cls = 'READ_PROJECTION';
  else cls = 'OTHER';

  // Side-effect ordering. Only *material* effects count: persistence, agent/AI
  // execution, network, media capture, and notifications that leave the browser.
  // A toast or a re-render is presentation, not an effect that needs a gate.
  const EXTERNAL_NOTIFY = /(notifyClient\(|notifyManager\(|notificationService\.(create|push|send|add))/;
  const effectRe = new RegExp(
    [PROBES.dbWrite.source, PROBES.agent.source, PROBES.net.source, EXTERNAL_NOTIFY.source].join('|'),
    '',
  );
  // A gate is an early return, a thrown refusal, a domain/authorization check or
  // a user confirmation — anything that can stop the path before the effect.
  const guardRe = /(if \(!|if \(.*(===|!==|<|>).*\)\s*\{?\s*(return|throw)|return;|return false|throw |assert[A-Z]|validate[A-Z]|authorize[A-Z]|gate[A-Z]|confirm\(|\.ok\b|\.ready\b|canSubmit|blocked)/;
  const effectAt = body.search(effectRe);
  const guardAt = body.search(guardRe);
  let ordering;
  if (effectAt === -1) ordering = 'NO_EFFECT';
  else if (guardAt === -1) ordering = 'EFFECT_FIRST';
  else if (guardAt < effectAt) ordering = 'GATE_FIRST';
  else ordering = 'EFFECT_FIRST';

  return { ...m, lines: m.end - m.start + 1, cls, ordering, p };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('method', 30), pad('lines', 6), pad('class', 30), pad('order', 12), 'w/c/a/n/e');
for (const r of rows) {
  console.log(
    pad(r.name, 30), pad(r.lines, 6), pad(r.cls, 30), pad(r.ordering, 12),
    `${r.p.dbWrite}/${r.p.canonical}/${r.p.agent}/${r.p.notify}/${r.p.net}`,
  );
}

const tally = (key) => rows.reduce((acc, r) => { acc[r[key]] = (acc[r[key]] || 0) + 1; return acc; }, {});
console.log('\n=== responsibility classes ===');
console.log(tally('cls'));
console.log('\n=== side-effect ordering ===');
console.log(tally('ordering'));
console.log('\ntotal methods:', rows.length, 'total classified lines:', rows.reduce((a, r) => a + r.lines, 0));
console.log('effect-bearing methods:', rows.filter((r) => r.ordering !== 'NO_EFFECT').length);
