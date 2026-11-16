/**
 * Social Packet — capa de salida estilo AutoPostsEngine sobre ContentItem.
 * Nada se marca listo para postear sin ClaimSafety PASS y (opcional) aprobación de autor.
 */

import type { ClaimSafetyVerdictRecord, ContentItem, ContentPipelineStatus } from '../types';

export type SocialPacketChannel = 'LinkedIn';

export type SocialPacketStatus =
  | 'DRAFT'
  | 'PENDING_AUTHOR'
  | 'APPROVED_FOR_POST'
  | 'READY_TO_POST'
  | 'POSTED';

export interface SocialPacket {
  readonly id: string;
  readonly contentId: string;
  readonly clientId: string;
  readonly channel: SocialPacketChannel;
  readonly status: SocialPacketStatus;
  readonly copy: string;
  readonly scheduledHint: string;
  readonly createdAt: string;
  readonly approvedAt?: string;
  readonly postedAt?: string;
}

export interface PostingKit {
  readonly packetId: string;
  readonly channel: SocialPacketChannel;
  readonly copy: string;
  readonly scheduledHint: string;
  readonly linkedInComposeUrl: string;
  readonly instructions: string;
}

const LINKEDIN_COMPOSE = 'https://www.linkedin.com/feed/?shareActive=true';

export function claimSafetyAllowsPacket(
  claimSafety: ClaimSafetyVerdictRecord | null | undefined
): boolean {
  if (!claimSafety) return true;
  return claimSafety.verdict === 'PASS';
}

export function canCreateSocialPacket(input: {
  pipelineStatus: ContentPipelineStatus | string | null | undefined;
  legacyStatus: string;
  claimSafety: ClaimSafetyVerdictRecord | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!claimSafetyAllowsPacket(input.claimSafety)) {
    return { ok: false, reason: 'ClaimSafety debe ser PASS antes de crear el packet.' };
  }
  const pipeline = input.pipelineStatus || '';
  const ready =
    pipeline === 'ready_to_publish' ||
    pipeline === 'client_submitted' ||
    pipeline === 'qa_check' ||
    pipeline === 'manager_finalizing' ||
    input.legacyStatus === 'APPROVED' ||
    input.legacyStatus === 'READY';
  if (!ready) {
    return {
      ok: false,
      reason: 'El contenido debe estar al menos en revisión final / listo para publicar.',
    };
  }
  return { ok: true };
}

export function createSocialPacketFromContent(input: {
  contentId: string;
  clientId: string;
  title: string;
  body: string;
  claimSafety: ClaimSafetyVerdictRecord | null | undefined;
  pipelineStatus?: string | null;
  legacyStatus: string;
  now?: string;
  idFactory?: () => string;
}): { ok: true; packet: SocialPacket } | { ok: false; reason: string } {
  const gate = canCreateSocialPacket({
    pipelineStatus: input.pipelineStatus,
    legacyStatus: input.legacyStatus,
    claimSafety: input.claimSafety,
  });
  if (!gate.ok) return gate;

  const copy = (input.body || input.title || '').trim();
  if (!copy) return { ok: false, reason: 'El packet necesita copy (cuerpo o título).' };

  const now = input.now ?? new Date().toISOString();
  const id = input.idFactory?.() ?? `spk_${input.contentId}_${now.slice(0, 10)}`;

  return {
    ok: true,
    packet: {
      id,
      contentId: input.contentId,
      clientId: input.clientId,
      channel: 'LinkedIn',
      status: 'PENDING_AUTHOR',
      copy,
      scheduledHint: '09:30',
      createdAt: now,
    },
  };
}

export function approveSocialPacketByAuthor(
  packet: SocialPacket,
  now = new Date().toISOString()
): SocialPacket {
  if (packet.status !== 'PENDING_AUTHOR' && packet.status !== 'DRAFT') {
    return packet;
  }
  return {
    ...packet,
    status: 'APPROVED_FOR_POST',
    approvedAt: now,
  };
}

export function markSocialPacketReadyToPost(packet: SocialPacket): SocialPacket {
  if (packet.status !== 'APPROVED_FOR_POST') return packet;
  return { ...packet, status: 'READY_TO_POST' };
}

export function markSocialPacketPosted(
  packet: SocialPacket,
  now = new Date().toISOString()
): SocialPacket {
  if (packet.status !== 'READY_TO_POST' && packet.status !== 'APPROVED_FOR_POST') {
    return packet;
  }
  return { ...packet, status: 'POSTED', postedAt: now };
}

export function buildLinkedInPostingKit(packet: SocialPacket): PostingKit | null {
  if (packet.status !== 'READY_TO_POST' && packet.status !== 'APPROVED_FOR_POST') {
    return null;
  }
  return {
    packetId: packet.id,
    channel: 'LinkedIn',
    copy: packet.copy,
    scheduledHint: packet.scheduledHint,
    linkedInComposeUrl: LINKEDIN_COMPOSE,
    instructions:
      'Copia el texto, ábrelo en LinkedIn y publica manualmente. Luego marca el contenido como Publicado en Producción.',
  };
}

/** Helper for ContentItem-shaped inputs without importing db. */
export function packetFromContentItem(
  content: Pick<
    ContentItem,
    'id' | 'clientId' | 'title' | 'body' | 'status' | 'pipelineStatus' | 'claimSafety'
  >,
  opts?: { now?: string; idFactory?: () => string }
): { ok: true; packet: SocialPacket } | { ok: false; reason: string } {
  return createSocialPacketFromContent({
    contentId: content.id,
    clientId: content.clientId,
    title: content.title,
    body: content.body ?? '',
    claimSafety: content.claimSafety,
    pipelineStatus: content.pipelineStatus,
    legacyStatus: content.status,
    now: opts?.now,
    idFactory: opts?.idFactory,
  });
}
