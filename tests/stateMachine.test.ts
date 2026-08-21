import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, curationLifecycle, DELIVERY_TRANSITIONS, SIGNAL_TRANSITIONS } from '../src/domain/stateMachine';

describe('stateMachine', () => {
  it('allows valid signal transitions', () => {
    expect(canTransition('NEW', 'ANALYZED', SIGNAL_TRANSITIONS)).toBe(true);
    expect(canTransition('DISCARDED', 'NEW', SIGNAL_TRANSITIONS)).toBe(false);
  });

  it('throws on invalid signal transition', () => {
    expect(() => assertTransition('CONVERTED', 'NEW', SIGNAL_TRANSITIONS, 'SIGNAL')).toThrow(
      'SIGNAL_INVALID_TRANSITION'
    );
  });

  it('enforces delivery DRAFT → SENT → ACKNOWLEDGED', () => {
    expect(canTransition('DRAFT', 'SENT', DELIVERY_TRANSITIONS)).toBe(true);
    expect(canTransition('SENT', 'ACKNOWLEDGED', DELIVERY_TRANSITIONS)).toBe(true);
    expect(canTransition('DRAFT', 'ACKNOWLEDGED', DELIVERY_TRANSITIONS)).toBe(false);
    expect(() => assertTransition('SENT', 'DRAFT', DELIVERY_TRANSITIONS, 'DELIVERY')).toThrow(
      'DELIVERY_INVALID_TRANSITION'
    );
  });

  it('derives curation lifecycle from destination and package', () => {
    expect(curationLifecycle({ destination: null })).toBe('PENDING');
    expect(curationLifecycle({ destination: 'TASK_VIDEO', deliveryPackageId: null })).toBe('READY');
    expect(curationLifecycle({ destination: 'TASK_VIDEO', deliveryPackageId: 'pkg_1' })).toBe('PACKAGED');
    expect(curationLifecycle({ destination: 'DISCARD', deliveryPackageId: null })).toBe('DISCARDED');
  });
});
