// Counts the acceptance rows so the summary line cannot drift from the table.
// Phase 3 recorded a tally-drift defect; this makes the check mechanical.
import { readFileSync } from 'node:fs';

const text = readFileSync('specs/010-react-migration/acceptance.md', 'utf8');

// Only the main criteria table: rows that start with an A-id and carry a verdict.
const rows = text
  .split('\n')
  .filter((l) => /^\|\s*A\d+\s*\|/.test(l));

const tally = { PASS: 0, PARTIAL: 0, FAIL: 0, PENDING: 0 };
const seen = new Set();
for (const row of rows) {
  const id = /^\|\s*(A\d+)\s*\|/.exec(row)?.[1];
  if (!id || seen.has(id)) continue;
  seen.add(id);
  if (/✅ PASS/.test(row)) tally.PASS += 1;
  else if (/⚠️ PARTIAL/.test(row)) tally.PARTIAL += 1;
  else if (/❌ FAIL/.test(row)) tally.FAIL += 1;
  else if (/⏳ PENDING/.test(row)) tally.PENDING += 1;
}

console.log('distinct criteria rows:', seen.size);
console.log(tally);
const pending = [...seen].filter((id) => {
  const row = rows.find((r) => new RegExp(`^\\|\\s*${id}\\s*\\|`).test(r));
  return row && /⏳ PENDING/.test(row);
});
console.log('still PENDING:', pending.join(', ') || '(none)');
