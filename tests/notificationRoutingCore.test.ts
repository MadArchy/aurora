import { describe, expect, it } from 'vitest';
import {
  expandUidAliases,
  LEGACY_MANAGER_UID,
  remapNotificationUserId,
  resolveClientUserId,
  resolveManagerUserId,
} from '../src/domain/notificationRoutingCore';

describe('notificationRoutingCore', () => {
  it('resolves manager from primaryManagerId', () => {
    expect(resolveManagerUserId({ primaryManagerId: 'fb_mgr' }, 'other')).toBe('fb_mgr');
    expect(resolveManagerUserId({ primaryManagerId: '' }, 'fb_mgr')).toBe('fb_mgr');
    expect(resolveManagerUserId(null, null)).toBeNull();
  });

  it('resolves client userId', () => {
    expect(resolveClientUserId({ userId: 'fb_juan' })).toBe('fb_juan');
    expect(resolveClientUserId({ userId: null })).toBeNull();
  });

  it('expands legacy aliases for inbox filter', () => {
    const set = expandUidAliases('firebase_abc', { [LEGACY_MANAGER_UID]: 'firebase_abc' });
    expect(set.has('firebase_abc')).toBe(true);
    expect(set.has(LEGACY_MANAGER_UID)).toBe(true);
  });

  it('remaps notification user ids', () => {
    expect(remapNotificationUserId(LEGACY_MANAGER_UID, LEGACY_MANAGER_UID, 'fb')).toBe('fb');
    expect(remapNotificationUserId('other', LEGACY_MANAGER_UID, 'fb')).toBe('other');
  });
});
