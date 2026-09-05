/**
 * T508 Decision B — focused rollback stable-storage comparator tests.
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalizeJsonStorageValue,
  canonicalizeRollbackStableSnapshot,
} from '../e2e/helpers/spec010Auth.ts';

function equalStableSnapshots(before: Record<string, string>, after: Record<string, string>): boolean {
  const left = canonicalizeRollbackStableSnapshot(before);
  const right = canonicalizeRollbackStableSnapshot(after);
  return JSON.stringify(left) === JSON.stringify(right);
}

describe('T508 rollback stable snapshot comparator', () => {
  describe('PASS — JSON object property order only', () => {
    it('treats top-level object key order as equal', () => {
      const before = { postura_notifications_v4: '[{"id":"x","body":"y","createdAt":"z"}]' };
      const after = { postura_notifications_v4: '[{"createdAt":"z","body":"y","id":"x"}]' };
      expect(equalStableSnapshots(before, after)).toBe(true);
    });

    it('treats nested object key order as equal', () => {
      const before = {
        postura_audit_logs:
          '[{"action":"LOGIN","details":{"actorRole":"ADMIN","actorUid":"u1"},"entityId":"u1"}]',
      };
      const after = {
        postura_audit_logs:
          '[{"details":{"actorUid":"u1","actorRole":"ADMIN"},"entityId":"u1","action":"LOGIN"}]',
      };
      expect(equalStableSnapshots(before, after)).toBe(true);
    });
  });

  describe('FAIL — business value changes must still be detected', () => {
    const baseNotification =
      '[{"id":"ntf_1","title":"Title","body":"Body","read":false,"createdAt":"2026-01-01T00:00:00.000Z","userId":"u1","organizationId":"org_1","type":"BRIEFING"}]';

    it('fails when notification body changes', () => {
      const after = baseNotification.replace('"Body"', '"Changed body"');
      expect(
        equalStableSnapshots(
          { postura_notifications_v4: baseNotification },
          { postura_notifications_v4: after }
        )
      ).toBe(false);
    });

    it('fails when notification title changes', () => {
      const after = baseNotification.replace('"Title"', '"Changed title"');
      expect(
        equalStableSnapshots(
          { postura_notifications_v4: baseNotification },
          { postura_notifications_v4: after }
        )
      ).toBe(false);
    });

    it('fails when notification read state changes', () => {
      const after = baseNotification.replace('"read":false', '"read":true');
      expect(
        equalStableSnapshots(
          { postura_notifications_v4: baseNotification },
          { postura_notifications_v4: after }
        )
      ).toBe(false);
    });

    it('fails when notification ID changes', () => {
      const after = baseNotification.replace('"ntf_1"', '"ntf_2"');
      expect(
        equalStableSnapshots(
          { postura_notifications_v4: baseNotification },
          { postura_notifications_v4: after }
        )
      ).toBe(false);
    });

    it('fails when notification count changes', () => {
      const after = baseNotification.replace('}]', '},{"id":"ntf_2","title":"Extra","body":"More","read":false,"createdAt":"2026-01-02T00:00:00.000Z","userId":"u1","organizationId":"org_1","type":"BRIEFING"}]');
      expect(
        equalStableSnapshots(
          { postura_notifications_v4: baseNotification },
          { postura_notifications_v4: after }
        )
      ).toBe(false);
    });

    it('fails when notification array order changes', () => {
      const first =
        '[{"id":"ntf_a","title":"A","body":"A","read":false,"createdAt":"2026-01-01T00:00:00.000Z","userId":"u1","organizationId":"org_1","type":"BRIEFING"}]';
      const second =
        '[{"id":"ntf_b","title":"B","body":"B","read":false,"createdAt":"2026-01-02T00:00:00.000Z","userId":"u1","organizationId":"org_1","type":"BRIEFING"}]';
      const before = { postura_notifications_v4: `[${first.slice(1, -1)},${second.slice(1, -1)}]` };
      const after = { postura_notifications_v4: `[${second.slice(1, -1)},${first.slice(1, -1)}]` };
      expect(equalStableSnapshots(before, after)).toBe(false);
    });

    it('fails when a business audit is added', () => {
      const before = { postura_audit_logs: '[{"action":"LOGIN","entityId":"u1"}]' };
      const after = {
        postura_audit_logs:
          '[{"action":"DELIVERY_SENT","entityId":"pkg_1"},{"action":"LOGIN","entityId":"u1"}]',
      };
      expect(equalStableSnapshots(before, after)).toBe(false);
    });

    it('fails when a business audit is removed', () => {
      const before = {
        postura_audit_logs:
          '[{"action":"DELIVERY_SENT","entityId":"pkg_1"},{"action":"LOGIN","entityId":"u1"}]',
      };
      const after = { postura_audit_logs: '[{"action":"LOGIN","entityId":"u1"}]' };
      expect(equalStableSnapshots(before, after)).toBe(false);
    });

    it('fails when audit payload changes', () => {
      const before = { postura_audit_logs: '[{"action":"DELIVERY_SENT","entityId":"pkg_1","details":{"channel":"email"}}]' };
      const after = {
        postura_audit_logs: '[{"action":"DELIVERY_SENT","entityId":"pkg_1","details":{"channel":"sms"}}]',
      };
      expect(equalStableSnapshots(before, after)).toBe(false);
    });

    it('fails when a raw non-JSON value changes', () => {
      const before = { postura_plain_token: 'alpha-token' };
      const after = { postura_plain_token: 'beta-token' };
      expect(equalStableSnapshots(before, after)).toBe(false);
      expect(canonicalizeJsonStorageValue('alpha-token')).toBe('alpha-token');
    });

    it('fails when notification UID alias value changes', () => {
      const before = { postura_notification_uid_aliases_v1: '{"user_admin_01":"uid_a"}' };
      const after = { postura_notification_uid_aliases_v1: '{"user_admin_01":"uid_b"}' };
      expect(equalStableSnapshots(before, after)).toBe(false);
    });
  });
});
