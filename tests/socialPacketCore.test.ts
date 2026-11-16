import { describe, expect, it } from 'vitest';
import {
  approveSocialPacketByAuthor,
  buildLinkedInPostingKit,
  canCreateSocialPacket,
  createSocialPacketFromContent,
  markSocialPacketPosted,
  markSocialPacketReadyToPost,
} from '../src/domain/socialPacketCore';

describe('socialPacketCore', () => {
  it('blocks packet when ClaimSafety is not PASS', () => {
    const gate = canCreateSocialPacket({
      pipelineStatus: 'ready_to_publish',
      legacyStatus: 'READY',
      claimSafety: {
        verdict: 'BLOCK',
        summary: 'blocked',
        findings: [
          {
            kind: 'UNSOURCED',
            severity: 'BLOCK',
            claim: 'x',
            detail: 'unsourced',
            action: 'cite',
          },
        ],
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(gate.ok).toBe(false);
  });

  it('creates PENDING_AUTHOR packet and posting kit after author approval', () => {
    const created = createSocialPacketFromContent({
      contentId: 'cnt_1',
      clientId: 'cli_1',
      title: 'Post',
      body: 'Hook + body for LinkedIn',
      claimSafety: { verdict: 'PASS', summary: 'ok', findings: [], reviewedAt: '2026-01-01T00:00:00.000Z' },
      pipelineStatus: 'ready_to_publish',
      legacyStatus: 'READY',
      now: '2026-11-15T12:00:00.000Z',
      idFactory: () => 'spk_test',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.packet.status).toBe('PENDING_AUTHOR');
    expect(buildLinkedInPostingKit(created.packet)).toBeNull();

    const approved = approveSocialPacketByAuthor(created.packet, '2026-11-15T12:01:00.000Z');
    expect(approved.status).toBe('APPROVED_FOR_POST');

    const ready = markSocialPacketReadyToPost(approved);
    const kit = buildLinkedInPostingKit(ready);
    expect(kit?.copy).toBe('Hook + body for LinkedIn');
    expect(kit?.linkedInComposeUrl).toContain('linkedin.com');

    const posted = markSocialPacketPosted(ready, '2026-11-15T12:05:00.000Z');
    expect(posted.status).toBe('POSTED');
    expect(posted.postedAt).toBe('2026-11-15T12:05:00.000Z');
  });
});
