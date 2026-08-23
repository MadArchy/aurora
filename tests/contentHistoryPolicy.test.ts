import { describe, expect, it } from 'vitest';
import {
  CLIENT_STATE_HISTORY_AUTHORITATIVE,
  CONTENT_CANONICAL_WORKFLOW_FIELD,
  CONTENT_TRUSTED_AUDIT_CLOCK,
  stripNonAuthoritativeContentHistory,
} from '../src/domain/contentHistoryPolicy';

describe('contentHistoryPolicy (SPEC-009 F-009-A MODEL B)', () => {
  it('freezes pipelineStatus + updatedAt as canonical; stateHistory non-authoritative', () => {
    expect(CLIENT_STATE_HISTORY_AUTHORITATIVE).toBe(false);
    expect(CONTENT_CANONICAL_WORKFLOW_FIELD).toBe('pipelineStatus');
    expect(CONTENT_TRUSTED_AUDIT_CLOCK).toBe('updatedAt');
  });

  it('strips stateHistory for CLIENT Firestore persist without dropping workflow fields', () => {
    const doc = {
      id: 'c1',
      pipelineStatus: 'client_in_progress',
      updatedAt: '2026-08-22T00:00:00Z',
      title: 'Article',
      stateHistory: [
        {
          state: 'client_in_progress',
          actorUid: 'juan',
          actorRole: 'CLIENT',
          at: '1999-01-01T00:00:00Z',
        },
      ],
    };
    const stripped = stripNonAuthoritativeContentHistory(doc);
    expect(stripped).not.toHaveProperty('stateHistory');
    expect(stripped.pipelineStatus).toBe('client_in_progress');
    expect(stripped.updatedAt).toBe('2026-08-22T00:00:00Z');
    expect(stripped.title).toBe('Article');
  });
});
