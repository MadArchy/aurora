import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, curationLifecycle, SIGNAL_TRANSITIONS } from '../src/domain/stateMachine';

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

  it('derives curation lifecycle from destination and package', () => {
    expect(curationLifecycle({ destination: null })).toBe('PENDING');
    expect(curationLifecycle({ destination: 'TASK_VIDEO', deliveryPackageId: null })).toBe('READY');
    expect(curationLifecycle({ destination: 'TASK_VIDEO', deliveryPackageId: 'pkg_1' })).toBe('PACKAGED');
    expect(curationLifecycle({ destination: 'DISCARD', deliveryPackageId: null })).toBe('DISCARDED');
  });
});
