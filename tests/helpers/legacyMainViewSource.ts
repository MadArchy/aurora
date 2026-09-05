/** Test helper — extracts LegacyApp.renderMainView source without importing side effects. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function renderMainViewSource(): string {
  const source = readFileSync(resolve('src/ui/legacy/LegacyApp.ts'), 'utf8');
  const match = source.match(/private renderMainView\(\): string \{[\s\S]*?^\s{2}\}/m);
  if (!match) throw new Error('renderMainView block not found');
  return match[0];
}
