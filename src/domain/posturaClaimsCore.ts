/**
 * SPEC-009 Phase 4 — fail-closed Postura custom claims (no default tenant).
 *
 * ADMIN:  role + organizationId required; clientId forced null
 * CLIENT: role + organizationId + clientId required
 */
export type PosturaRole = 'ADMIN' | 'CLIENT';

export interface PosturaAuthClaims {
  role: PosturaRole;
  organizationId: string;
  clientId: string | null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse ID-token / raw claims. Missing org or CLIENT clientId → null (session fail). */
export function parsePosturaClaims(raw: Record<string, unknown>): PosturaAuthClaims | null {
  const role = raw.role;
  if (role !== 'ADMIN' && role !== 'CLIENT') return null;

  const organizationId = nonEmptyString(raw.organizationId);
  if (!organizationId) return null;

  if (role === 'ADMIN') {
    return { role: 'ADMIN', organizationId, clientId: null };
  }

  const clientId = nonEmptyString(raw.clientId);
  if (!clientId) return null;
  return { role: 'CLIENT', organizationId, clientId };
}

export type ClaimsProvisionErrorCode =
  | 'INVALID_ROLE'
  | 'ORGANIZATION_ID_REQUIRED'
  | 'CLIENT_ID_REQUIRED';

export class ClaimsProvisionError extends Error {
  readonly code: ClaimsProvisionErrorCode;

  constructor(code: ClaimsProvisionErrorCode, message: string) {
    super(message);
    this.name = 'ClaimsProvisionError';
    this.code = code;
  }
}

/** Build claims for Admin setCustomUserClaims / provision. Throws on invalid input. */
export function buildPosturaClaimsOrThrow(input: {
  role: unknown;
  organizationId?: unknown;
  clientId?: unknown;
}): PosturaAuthClaims {
  if (input.role !== 'ADMIN' && input.role !== 'CLIENT') {
    throw new ClaimsProvisionError('INVALID_ROLE', 'role must be ADMIN or CLIENT');
  }

  const organizationId = nonEmptyString(input.organizationId);
  if (!organizationId) {
    throw new ClaimsProvisionError(
      'ORGANIZATION_ID_REQUIRED',
      'organizationId is required (no default tenant)'
    );
  }

  if (input.role === 'ADMIN') {
    return { role: 'ADMIN', organizationId, clientId: null };
  }

  const clientId = nonEmptyString(input.clientId);
  if (!clientId) {
    throw new ClaimsProvisionError('CLIENT_ID_REQUIRED', 'clientId is required for CLIENT role');
  }

  return { role: 'CLIENT', organizationId, clientId };
}
