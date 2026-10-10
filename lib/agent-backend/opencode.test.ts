import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { setToken } from '@/lib/storage/auth';
import { setSettings } from '@/lib/storage/settings';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from './opencode-api';
import { OpenCodeBackend } from './opencode';

const BASE = 'http://127.0.0.1:15001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenCodeBackend.ping', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('reports not paired without touching the network when no token is stored', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    const status = await new OpenCodeBackend().ping();

    expect(status).toEqual({ ok: false, detail: 'Not paired' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports the server version with a stored token', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({ ok: true, detail: 'opencode 2.0.24' });
  });

  it('reports a rejected token', async () => {
    await setToken('stale');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Pairing token rejected',
    });
  });

  it('reports an unreachable server with its URL', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: `Cannot reach the opencode server at ${BASE}`,
    });
  });

  it('prefers explicit config over storage', async () => {
    await setToken('stale');
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '9.9.9' }));
    const backend = new OpenCodeBackend({ baseUrl: 'http://127.0.0.1:4096', token: 'tok_explicit', fetchFn });

    await expect(backend.ping()).resolves.toEqual({ ok: true, detail: 'opencode 9.9.9' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('http://127.0.0.1:4096/api/info');
    expect(call?.[1]?.headers).toEqual({ Authorization: 'Basic b3BlbmNvZGU6dG9rX2V4cGxpY2l0' });
  });
});

describe('OpenCodeBackend.listProjects', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('lists projects from the configured server', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });
    await setToken('tok_live');
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse([{ id: 'proj_1', canonical: '/home/afif/example', time: {}, sandboxes: [] }]),
    );
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'example', directory: '/home/afif/example' },
    ]);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4096/api/project');
  });

  it('returns an empty list when the server knows no projects', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse([])));

    await expect(new OpenCodeBackend().listProjects()).resolves.toEqual([]);
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listProjects()).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
