import { describe, expect, it } from 'vitest';
import { SERVER_URL_ERRORS, isLoopbackHost, parseLoopbackUrl } from './endpoint';

describe('parseLoopbackUrl', () => {
  it('accepts the literal loopback addresses and keeps a canonical endpoint', () => {
    expect(parseLoopbackUrl('http://127.0.0.1:15001')).toEqual({
      ok: true,
      endpoint: 'http://127.0.0.1:15001',
    });
    expect(parseLoopbackUrl('http://localhost:4096')).toEqual({ ok: true, endpoint: 'http://localhost:4096' });
    expect(parseLoopbackUrl('https://127.0.0.2:443')).toEqual({ ok: true, endpoint: 'https://127.0.0.2' });
    expect(parseLoopbackUrl('http://[::1]:15001')).toEqual({ ok: true, endpoint: 'http://[::1]:15001' });
  });

  it('trims whitespace and drops a trailing slash, query, and hash', () => {
    expect(parseLoopbackUrl('  http://127.0.0.1:15001/  ')).toEqual({
      ok: true,
      endpoint: 'http://127.0.0.1:15001',
    });
    expect(parseLoopbackUrl('http://127.0.0.1:15001/?debug=1#x')).toEqual({
      ok: true,
      endpoint: 'http://127.0.0.1:15001',
    });
    expect(parseLoopbackUrl('http://127.0.0.1:15001/base/')).toEqual({
      ok: true,
      endpoint: 'http://127.0.0.1:15001/base',
    });
  });

  it('rejects an empty value', () => {
    expect(parseLoopbackUrl('   ')).toEqual({ ok: false, error: SERVER_URL_ERRORS.empty });
  });

  it('rejects a value that is not a URL', () => {
    expect(parseLoopbackUrl('127.0.0.1:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.invalid });
    expect(parseLoopbackUrl('not a url')).toEqual({ ok: false, error: SERVER_URL_ERRORS.invalid });
  });

  it('rejects a protocol that is not http or https', () => {
    expect(parseLoopbackUrl('ftp://127.0.0.1:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.protocol });
    expect(parseLoopbackUrl('file:///home/afif')).toEqual({ ok: false, error: SERVER_URL_ERRORS.protocol });
  });

  it('rejects credentials embedded in the URL', () => {
    expect(parseLoopbackUrl('http://user:pass@127.0.0.1:15001')).toEqual({
      ok: false,
      error: SERVER_URL_ERRORS.credentials,
    });
    expect(parseLoopbackUrl('http://opencode:tok@localhost:15001')).toEqual({
      ok: false,
      error: SERVER_URL_ERRORS.credentials,
    });
  });

  it('rejects any host that is not on this machine', () => {
    expect(parseLoopbackUrl('https://example.com')).toEqual({ ok: false, error: SERVER_URL_ERRORS.remote });
    expect(parseLoopbackUrl('http://192.168.1.10:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.remote });
    expect(parseLoopbackUrl('http://10.0.0.5:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.remote });
    expect(parseLoopbackUrl('http://0.0.0.0:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.remote });
    expect(parseLoopbackUrl('http://127.0.0.1.evil.example:15001')).toEqual({
      ok: false,
      error: SERVER_URL_ERRORS.remote,
    });
    expect(parseLoopbackUrl('http://localhost.evil.example:15001')).toEqual({
      ok: false,
      error: SERVER_URL_ERRORS.remote,
    });
    expect(parseLoopbackUrl('http://[2001:db8::1]:15001')).toEqual({ ok: false, error: SERVER_URL_ERRORS.remote });
  });
});

describe('isLoopbackHost', () => {
  it('accepts loopback hosts literally, never by resolution', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('127.9.9.9')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('::1.evil.example')).toBe(false);
    expect(isLoopbackHost('[::2]')).toBe(false);
    expect(isLoopbackHost('128.0.0.1')).toBe(false);
  });
});
