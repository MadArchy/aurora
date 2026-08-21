import { describe, expect, it } from 'vitest';
import {
  applyScopedCollectionMerge,
  mergeRowsById,
  replaceClientScopedRows,
} from '../src/domain/firestoreMergeCore';

describe('firestoreMergeCore', () => {
  it('merges by id without dropping other rows', () => {
    const merged = mergeRowsById(
      [
        { id: 'a', clientId: 'c1', name: 'old' },
        { id: 'b', clientId: 'c2', name: 'keep' },
      ],
      [{ id: 'a', clientId: 'c1', name: 'new' }]
    );
    expect(merged).toEqual([
      { id: 'a', clientId: 'c1', name: 'new' },
      { id: 'b', clientId: 'c2', name: 'keep' },
    ]);
  });

  it('replaces only one client scope and applies deletions', () => {
    const next = replaceClientScopedRows(
      [
        { id: 's1', clientId: 'juan' },
        { id: 's2', clientId: 'juan' },
        { id: 's3', clientId: 'elena' },
      ],
      [{ id: 's2', clientId: 'juan' }],
      'juan'
    );
    expect(next.map((r) => r.id).sort()).toEqual(['s2', 's3']);
  });

  it('clears scoped rows when remote list is empty', () => {
    const next = replaceClientScopedRows(
      [
        { id: 's1', clientId: 'juan' },
        { id: 's3', clientId: 'elena' },
      ],
      [],
      'juan'
    );
    expect(next).toEqual([{ id: 's3', clientId: 'elena' }]);
  });

  it('applyScopedCollectionMerge uses scope when provided', () => {
    const existing = [
      { id: '1', clientId: 'a' },
      { id: '2', clientId: 'b' },
    ];
    const result = applyScopedCollectionMerge(existing, [{ id: '3', clientId: 'a' }], {
      merge: true,
      scopeClientId: 'a',
    });
    expect(result?.map((r) => r.id).sort()).toEqual(['2', '3']);
  });
});
