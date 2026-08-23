import { describe, expect, it } from 'vitest';
import {
  listFirestoreClientIds,
  resolveTenantOrganizationIdForQuery,
} from '../src/services/firestore/sync';

describe('listFirestoreClientIds (Q1)', () => {
  it('resolveTenantOrganizationIdForQuery uses authenticated org', () => {
    expect(resolveTenantOrganizationIdForQuery('org_aurora_01')).toBe('org_aurora_01');
    expect(resolveTenantOrganizationIdForQuery('org_aurora_01', '')).toBe('org_aurora_01');
  });

  it('resolveTenantOrganizationIdForQuery rejects mismatched requested org', () => {
    expect(resolveTenantOrganizationIdForQuery('org_aurora_01', 'org_other_99')).toBeNull();
  });

  it('resolveTenantOrganizationIdForQuery allows matching requested org', () => {
    expect(resolveTenantOrganizationIdForQuery('org_aurora_01', 'org_aurora_01')).toBe(
      'org_aurora_01'
    );
  });

  it('resolveTenantOrganizationIdForQuery fails closed without auth org', () => {
    expect(resolveTenantOrganizationIdForQuery(null)).toBeNull();
    expect(resolveTenantOrganizationIdForQuery('')).toBeNull();
  });

  it('listFirestoreClientIds returns empty when Firebase is not configured', async () => {
    const ids = await listFirestoreClientIds('org_aurora_01');
    expect(ids).toEqual([]);
  });
});
