/**
 * Fase 1 — Hoy ≠ Clientes parity (React cockpit).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function code(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('React cockpit Hoy vs Clientes', () => {
  it('renders distinct panels for portfolio and clients tabs', () => {
    const cockpit = code('src/ui/modules/pages/ReactManagerCockpitPage.tsx');
    expect(cockpit).toMatch(/function HoyPanel/);
    expect(cockpit).toMatch(/function ClientsPanel/);
    expect(cockpit).toMatch(/react-cockpit-hoy/);
    expect(cockpit).toMatch(/react-cockpit-clients/);
    expect(cockpit).toMatch(/attentionScore > 0/);
    expect(cockpit).toMatch(/tab === 'clients'/);
    expect(cockpit).toMatch(/tab === 'ai'/);
    // No shared PortfolioPanel for both tabs
    expect(cockpit).not.toMatch(/function PortfolioPanel/);
    // Sidebar owns nav — no internal Hoy/Clientes/IA pills
    expect(cockpit).not.toMatch(/tab-pills/);
  });

  it('shell hides workspace nav without a selected client', () => {
    const shell = code('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(shell).toMatch(/normalizeTab/);
    expect(shell).toMatch(/inWorkspace \? \(/);
    expect(shell).toMatch(/\) : null\}/);
    // No portfolio-level Workspace nav group when out of client scope
    expect(shell).not.toMatch(/label="Workspace"/);
  });
});
