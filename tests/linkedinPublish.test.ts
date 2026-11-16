import { describe, expect, it } from 'vitest';
import { createSocialPacketFromContent, approveSocialPacketByAuthor } from '../src/domain/socialPacketCore';
import { publishSocialPacketToLinkedIn } from '../src/services/linkedinPublish';

describe('linkedinPublish gate', () => {
  it('refuses unpublished / unapproved packets', async () => {
    const created = createSocialPacketFromContent({
      contentId: 'c1',
      clientId: 'cli',
      title: 't',
      body: 'body',
      claimSafety: { verdict: 'PASS', summary: 'ok', findings: [], reviewedAt: '2026-01-01T00:00:00.000Z' },
      pipelineStatus: 'ready_to_publish',
      legacyStatus: 'READY',
      idFactory: () => 'spk1',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const denied = await publishSocialPacketToLinkedIn(created.packet, { oauthConfigured: false });
    expect(denied.ok).toBe(false);

    const approved = approveSocialPacketByAuthor(created.packet);
    const kit = await publishSocialPacketToLinkedIn(approved, { oauthConfigured: false });
    expect(kit.ok).toBe(true);
    if (kit.ok) expect(kit.mode).toBe('posting_kit');
  });
});
