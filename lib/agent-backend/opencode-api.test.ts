import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OpenCodeApi,
  redeemPairingCode,
  resetOpenCodeFetch,
  setOpenCodeFetch,
  type FetchLike,
} from './opencode-api';

const BASE = 'http://127.0.0.1:15001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

describe('redeemPairingCode', () => {
  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('exchanges a pairing code for the token', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ token: 'tok_live' }));
    setOpenCodeFetch(fetchFn);

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).resolves.toBe('tok_live');

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
    expect(call?.[1]?.method).toBe('GET');
    expect(call?.[1]?.headers).toEqual({ Accept: 'application/json' });
  });

  it('rejects a wrong or expired code with a clear message', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () =>
      jsonResponse({ _tag: 'UnauthorizedError', message: 'Pairing link expired or already used' }, 401),
    ));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'WRONG' })).rejects.toThrow(
      'That pairing code is wrong or expired',
    );
  });

  it('reports an unreachable server with its URL', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      `Cannot reach the opencode server at ${BASE}`,
    );
  });

  it('rejects a response without a token', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ nope: true })));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      'The opencode server sent an unexpected response',
    );
  });

  it('rejects a body that is not JSON', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => textResponse('<html>nope</html>')));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      'The opencode server sent an unexpected response',
    );
  });
});

describe('OpenCodeApi.info', () => {
  it('sends the token as a basic-auth password and returns the version', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24', pid: 1 }));
    const api = new OpenCodeApi({ baseUrl: `${BASE}/`, token: 'tok_live', fetchFn });

    await expect(api.info()).resolves.toEqual({ version: '2.0.24' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/info`);
    expect(call?.[1]?.headers).toEqual({ Authorization: 'Basic b3BlbmNvZGU6dG9rX2xpdmU=' });
  });

  it('reports a rejected token', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'stale',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)),
    });

    await expect(api.info()).rejects.toThrow('Pairing token rejected');
  });

  it('rejects a response without a version', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({})),
    });

    await expect(api.info()).rejects.toThrow('The opencode server sent an unexpected response');
  });
});

describe('OpenCodeApi.listProjects', () => {
  function project(overrides: Record<string, unknown>): unknown {
    return {
      id: 'proj_1',
      canonical: '/home/afif/example',
      time: { created: 1, updated: 1, active: 1 },
      sandboxes: [],
      ...overrides,
    };
  }

  it('maps server projects to name and directory', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse([project({})]));
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await expect(api.listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'example', directory: '/home/afif/example' },
    ]);

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/project`);
  });

  it('prefers the server-side name and trims a trailing slash', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () =>
        jsonResponse([project({ name: 'Example App', canonical: '/home/afif/example/' })]),
      ),
    });

    await expect(api.listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'Example App', directory: '/home/afif/example/' },
    ]);
  });

  it('returns an empty list when the server knows no projects', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse([])),
    });

    await expect(api.listProjects()).resolves.toEqual([]);
  });

  it('rejects a project without a directory', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse([{ id: 'proj_1' }])),
    });

    await expect(api.listProjects()).rejects.toThrow('The opencode server sent an unexpected response');
  });

  it('rejects a body that is not an array', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ data: [] })),
    });

    await expect(api.listProjects()).rejects.toThrow('The opencode server sent an unexpected response');
  });
});
