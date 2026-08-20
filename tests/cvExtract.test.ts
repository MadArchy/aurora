import { describe, expect, it } from 'vitest';
import { extractCandidateFactsFromCv } from '../src/domain/cvExtract';

describe('cvExtract', () => {
  it('extrae facts candidatos desde texto de CV', () => {
    const text = `
Juan Vasquez
Member — Whitaker Chalk PLLC
J.D. St. Mary's University School of Law
B.S. Electrical Engineering — UT Austin
Chair, Emerging Technology Committee — State Bar of Texas
https://linkedin.com/in/juanjvasquez
    `;
    const facts = extractCandidateFactsFromCv(text);
    expect(facts.length).toBeGreaterThan(3);
    expect(facts.every((f) => f.status === 'candidate')).toBe(true);
  });
});
