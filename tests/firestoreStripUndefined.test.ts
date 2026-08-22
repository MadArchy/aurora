import { describe, expect, it } from 'vitest';
import { stripUndefinedForFirestore } from '../src/services/firestore/sync';

describe('stripUndefinedForFirestore', () => {
  it('removes undefined fields that Firestore rejects', () => {
    const cleaned = stripUndefinedForFirestore({
      id: 'cnt_1',
      body: 'hola',
      clientReviewBaseline: undefined,
      nested: { a: 1, b: undefined },
      tags: ['x', undefined, 'y'],
    });
    expect(cleaned).toEqual({
      id: 'cnt_1',
      body: 'hola',
      nested: { a: 1 },
      tags: ['x', 'y'],
    });
    expect('clientReviewBaseline' in cleaned).toBe(false);
  });
});
