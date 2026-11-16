/**
 * LinkedIn publish gate (Fase 4) — OAuth publish is optional and never bypasses
 * author approval on a Social Packet.
 *
 * Without OAuth credentials configured, callers get a posting-kit fallback.
 */

import {
  buildLinkedInPostingKit,
  type SocialPacket,
} from '../domain/socialPacketCore';

export type LinkedInPublishResult =
  | { ok: true; mode: 'oauth'; postId: string }
  | { ok: true; mode: 'posting_kit'; kit: NonNullable<ReturnType<typeof buildLinkedInPostingKit>> }
  | { ok: false; message: string };

export function isLinkedInOAuthConfigured(
  env: { VITE_LINKEDIN_CLIENT_ID?: string } = import.meta.env as {
    VITE_LINKEDIN_CLIENT_ID?: string;
  }
): boolean {
  return Boolean(env.VITE_LINKEDIN_CLIENT_ID?.trim());
}

/**
 * Publish only when packet is APPROVED_FOR_POST or READY_TO_POST.
 * OAuth path is stubbed until LinkedIn app credentials + token exchange are live.
 */
export async function publishSocialPacketToLinkedIn(
  packet: SocialPacket,
  opts?: { oauthConfigured?: boolean }
): Promise<LinkedInPublishResult> {
  if (packet.status !== 'APPROVED_FOR_POST' && packet.status !== 'READY_TO_POST') {
    return {
      ok: false,
      message: 'El packet debe estar aprobado por el autor antes de publicar.',
    };
  }

  const oauth = opts?.oauthConfigured ?? isLinkedInOAuthConfigured();
  if (oauth) {
    // Stub: real token exchange / UGC Posts API lands when LinkedIn app is approved.
    return {
      ok: false,
      message:
        'OAuth LinkedIn configurado pero el intercambio de token aún no está desplegado. Usa el posting kit.',
    };
  }

  const kit = buildLinkedInPostingKit(packet);
  if (!kit) {
    return { ok: false, message: 'No se pudo armar el posting kit.' };
  }
  return { ok: true, mode: 'posting_kit', kit };
}
