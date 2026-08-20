import { describe, expect, it } from 'vitest';
import { assertSafeUrl, normalizeHostname } from '../server/ssrf';

describe('SSRF guard', () => {
  it('blocks localhost and private IPv4', () => {
    expect(() => assertSafeUrl('http://127.0.0.1/feed')).toThrow('SSRF_BLOCKED');
    expect(() => assertSafeUrl('http://192.168.1.10/rss')).toThrow('SSRF_BLOCKED');
    expect(() => assertSafeUrl('http://10.0.0.1/')).toThrow('SSRF_BLOCKED');
  });

  it('blocks localhost suffix and non-http schemes', () => {
    expect(() => assertSafeUrl('http://api.localhost/')).toThrow('SSRF_BLOCKED');
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow('URL_SCHEME_DENIED');
  });

  it('allows public hosts', () => {
    const url = assertSafeUrl('https://www.uspto.gov/rss');
    expect(url.hostname).toBe('www.uspto.gov');
  });

  it('normalizes bracketed IPv6 hostnames', () => {
    expect(normalizeHostname('[::1]')).toBe('::1');
  });
});
