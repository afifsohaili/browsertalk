import { describe, expect, it } from 'vitest';
import { parsePairingCredential } from './pairing-link';

describe('parsePairingCredential', () => {
  it('reads the link out of the full opencode pair output', () => {
    const output = [
      'Run `opencode pair` in a terminal.',
      'Copy the link. Do not open it. Links expire in 5 minutes.',
      '',
      'http://127.0.0.1:29422/auth/connect/9f2c1a4b',
    ].join('\n');

    expect(parsePairingCredential(output)).toEqual({
      ok: true,
      credential: {
        code: '9f2c1a4b',
        endpoint: 'http://127.0.0.1:29422',
        origin: 'http://127.0.0.1:29422',
        remote: false,
      },
    });
  });

  it('accepts the URL on its own', () => {
    expect(parsePairingCredential(' http://127.0.0.1:4096/auth/connect/ABC123 ')).toEqual({
      ok: true,
      credential: {
        code: 'ABC123',
        endpoint: 'http://127.0.0.1:4096',
        origin: 'http://127.0.0.1:4096',
        remote: false,
      },
    });
  });

  it('accepts a bare code and leaves the endpoint to the saved server URL', () => {
    expect(parsePairingCredential('  ABC123  ')).toEqual({
      ok: true,
      credential: { code: 'ABC123', endpoint: null, origin: null, remote: false },
    });
  });

  it('marks a non-loopback link as remote', () => {
    const parsed = parsePairingCredential('http://100.64.0.5:4096/auth/connect/ABC123');

    expect(parsed).toEqual({
      ok: true,
      credential: {
        code: 'ABC123',
        endpoint: 'http://100.64.0.5:4096',
        origin: 'http://100.64.0.5:4096',
        remote: true,
      },
    });
  });

  it('canonicalizes a link endpoint with a trailing slash', () => {
    const parsed = parsePairingCredential('http://127.0.0.1:29422/auth/connect/ABC123/');

    expect(parsed.ok && parsed.credential.endpoint).toBe('http://127.0.0.1:29422');
  });

  it('decodes the code from the link', () => {
    const parsed = parsePairingCredential('http://127.0.0.1:29422/auth/connect/abc%2F123');

    expect(parsed.ok && parsed.credential.code).toBe('abc/123');
  });

  it('asks for the link or code when empty', () => {
    expect(parsePairingCredential('   ')).toEqual({
      ok: false,
      error: 'Paste the pairing link or code',
    });
  });

  it('refuses a URL that is not a pairing link', () => {
    expect(parsePairingCredential('http://127.0.0.1:29422/api/info')).toEqual({
      ok: false,
      error: 'That link is not a pairing link — copy the link opencode pair prints',
    });
  });

  it('refuses prose without a link or a single code', () => {
    expect(parsePairingCredential('open the link in your browser')).toEqual({
      ok: false,
      error: 'Paste the pairing link or the code on its own',
    });
  });

  it('refuses a link with embedded credentials', () => {
    expect(parsePairingCredential('http://user:pass@127.0.0.1:29422/auth/connect/ABC123')).toEqual({
      ok: false,
      error: 'Remove the username and password from the server URL',
    });
  });

  it('refuses a malformed percent escape in the code', () => {
    expect(parsePairingCredential('http://127.0.0.1:29422/auth/connect/abc%ZZ')).toEqual({
      ok: false,
      error: 'That link is not a pairing link — copy the link opencode pair prints',
    });
  });

  it('accepts an IPv6 loopback link as local', () => {
    expect(parsePairingCredential('http://[::1]:4096/auth/connect/ABC123')).toEqual({
      ok: true,
      credential: {
        code: 'ABC123',
        endpoint: 'http://[::1]:4096',
        origin: 'http://[::1]:4096',
        remote: false,
      },
    });
  });

  it('marks a lookalike localhost host as remote', () => {
    const parsed = parsePairingCredential('http://localhost.evil.example:4096/auth/connect/ABC123');

    expect(parsed).toMatchObject({
      ok: true,
      credential: {
        endpoint: 'http://localhost.evil.example:4096',
        remote: true,
      },
    });
  });

  it('refuses two links in one paste', () => {
    const output = [
      'http://127.0.0.1:29422/auth/connect/AAA111',
      'http://127.0.0.1:29423/auth/connect/BBB222',
    ].join('\n');

    expect(parsePairingCredential(output)).toEqual({
      ok: false,
      error: 'Paste the pairing link or the code on its own',
    });
  });

  it('strips punctuation wrapped around the link', () => {
    const parsed = parsePairingCredential('See (http://127.0.0.1:29422/auth/connect/ABC123).');

    expect(parsed).toEqual({
      ok: true,
      credential: {
        code: 'ABC123',
        endpoint: 'http://127.0.0.1:29422',
        origin: 'http://127.0.0.1:29422',
        remote: false,
      },
    });
  });

  it('refuses a link with an unsupported scheme', () => {
    expect(parsePairingCredential('ftp://127.0.0.1:29422/auth/connect/ABC123')).toEqual({
      ok: false,
      error: 'That link is not a pairing link — copy the link opencode pair prints',
    });
  });
});
