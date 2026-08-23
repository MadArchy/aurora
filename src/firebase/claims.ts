import type { UserRole } from '../types';
import {
  parsePosturaClaims as parseCore,
  type PosturaAuthClaims as CoreClaims,
} from '../domain/posturaClaimsCore';

export type PosturaAuthClaims = CoreClaims & { role: UserRole };

export function parsePosturaClaims(raw: Record<string, unknown>): PosturaAuthClaims | null {
  return parseCore(raw);
}

export {
  buildPosturaClaimsOrThrow,
  ClaimsProvisionError,
  type ClaimsProvisionErrorCode,
} from '../domain/posturaClaimsCore';
