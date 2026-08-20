import type { UserRole } from '../types';

export interface PosturaAuthClaims {
  role: UserRole;
  organizationId: string;
  clientId?: string | null;
}

export function parsePosturaClaims(raw: Record<string, unknown>): PosturaAuthClaims | null {
  const role = raw.role;
  if (role !== 'ADMIN' && role !== 'CLIENT') return null;
  const organizationId = typeof raw.organizationId === 'string' ? raw.organizationId : 'org_aurora_01';
  const clientId = typeof raw.clientId === 'string' ? raw.clientId : null;
  if (role === 'CLIENT' && !clientId) return null;
  return { role, organizationId, clientId };
}
