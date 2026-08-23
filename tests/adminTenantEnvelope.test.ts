import { describe, expect, it } from 'vitest';
import {
  requireMatchingClientId,
  requireTenantOrganizationId,
} from '../src/domain/adminTenantEnvelopeCore';

describe('adminTenantEnvelopeCore (SPEC-009 Phase 4 / A24)', () => {
  it('requires explicit organizationId (no default tenant)', () => {
    expect(requireTenantOrganizationId({ organizationId: 'org_1' })).toBe('org_1');
    expect(() => requireTenantOrganizationId({})).toThrow(/organizationId/);
    expect(() => requireTenantOrganizationId({ organizationId: '  ' })).toThrow(/organizationId/);
    expect(() => requireTenantOrganizationId({ organizationId: undefined })).toThrow(
      /organizationId/
    );
  });

  it('does not fall back to org_aurora_01', () => {
    expect(() => requireTenantOrganizationId({ organizationId: null })).toThrow(/organizationId/);
  });

  it('requires path clientId and rejects mismatched source.clientId', () => {
    expect(requireMatchingClientId('client_a', {})).toBe('client_a');
    expect(requireMatchingClientId('client_a', { clientId: 'client_a' })).toBe('client_a');
    expect(() => requireMatchingClientId('client_a', { clientId: 'client_b' })).toThrow(
      /does not match/
    );
    expect(() => requireMatchingClientId('  ', {})).toThrow(/clientId/);
  });
});
