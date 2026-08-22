import { describe, expect, it } from 'vitest';
import {
  CLIENT_TABS,
  normalizeTab,
  PORTFOLIO_TABS,
  WORKSPACE_TABS,
} from '../src/components/PageHeader';

describe('navigation information architecture', () => {
  it('keeps retired manager routes compatible with the consolidated workflow', () => {
    expect(normalizeTab('ws-curation')).toBe('ws-deliver');
    expect(normalizeTab('ws-delivery')).toBe('ws-deliver');
    expect(normalizeTab('ws-tasks')).toBe('ws-production');
    expect(normalizeTab('ws-results')).toBe('ws-briefing');
  });

  it('keeps retired client routes compatible with the simplified portal', () => {
    expect(normalizeTab('client-feed')).toBe('client-home');
    expect(normalizeTab('client-profile')).toBe('client-profile');
    expect(normalizeTab('client-library')).toBe('client-content');
  });

  it('uses action-oriented labels for the primary destinations', () => {
    expect(PORTFOLIO_TABS.dashboard.title).toBe('Hoy');
    expect(WORKSPACE_TABS['ws-positioning'].title).toBe('Identidad');
    expect(CLIENT_TABS['client-home'].title).toBe('Esta semana');
    expect(CLIENT_TABS['client-content'].title).toBe('Revisar');
  });
});
