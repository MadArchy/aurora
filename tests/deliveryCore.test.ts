import { describe, expect, it } from 'vitest';
import {
  canEditDelivery,
  deliveryItemKindLabel,
  latestSentAt,
  readingTaskDescription,
  sortDeliveriesBySentAt,
  validateDeliveryForSend,
} from '../src/domain/deliveryCore';
import type { DeliveryPackage } from '../src/types';

function pkg(overrides: Partial<DeliveryPackage> = {}): DeliveryPackage {
  return {
    id: 'pkg_1',
    organizationId: 'org',
    clientId: 'c1',
    title: 'Briefing',
    strategicNote: '',
    periodLabel: 'agosto',
    items: [],
    status: 'SENT',
    createdAt: '2026-08-10T10:00:00Z',
    createdBy: 'admin',
    ...overrides,
  };
}

describe('deliveryCore', () => {
  it('sorts sent packages newest first', () => {
    const sorted = sortDeliveriesBySentAt([
      pkg({ id: 'a', sentAt: '2026-08-10T10:00:00Z' }),
      pkg({ id: 'b', sentAt: '2026-08-20T10:00:00Z' }),
      pkg({ id: 'c', sentAt: '2026-08-15T10:00:00Z' }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('picks latest sentAt for portfolio', () => {
    expect(
      latestSentAt([
        pkg({ sentAt: '2026-08-10T10:00:00Z' }),
        pkg({ sentAt: '2026-08-20T10:00:00Z' }),
        pkg({ status: 'DRAFT', sentAt: undefined }),
      ])
    ).toBe('2026-08-20T10:00:00Z');
  });

  it('only allows editing drafts', () => {
    expect(canEditDelivery(pkg({ status: 'DRAFT' }))).toBe(true);
    expect(canEditDelivery(pkg({ status: 'SENT' }))).toBe(false);
  });

  it('builds reading task description with url and rationale', () => {
    const text = readingTaskDescription({
      title: 'NIST AI RMF',
      rationale: 'Marco de gobernanza',
      url: 'https://nist.gov/ai',
    });
    expect(text).toContain('Marco de gobernanza');
    expect(text).toContain('https://nist.gov/ai');
  });

  it('labels item kinds in Spanish', () => {
    expect(deliveryItemKindLabel('READING')).toBe('Lectura');
    expect(deliveryItemKindLabel('TASK')).toBe('Tarea');
  });

  it('requires thesis when briefing has task items', () => {
    const pkg = {
      id: 'pkg_1',
      status: 'DRAFT' as const,
      items: [{ id: 'i1', kind: 'TASK' as const, title: 'Video', refId: 'c1' }],
    };
    const result = validateDeliveryForSend(
      pkg as import('../src/types').DeliveryPackage,
      () => 'TASK_VIDEO',
      undefined
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_THESIS');
  });

  it('rejects already sent packages', () => {
    const result = validateDeliveryForSend(
      { id: 'p', status: 'SENT', items: [{ id: 'i', kind: 'FILE', title: 'x' }] } as import('../src/types').DeliveryPackage,
      () => null,
      undefined
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ALREADY_SENT');
  });
});
