import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { getToken, setToken } from '@/lib/storage/auth';
import { getOriginBindings } from '@/lib/storage/projects';
import { setSettings } from '@/lib/storage/settings';
import { bindOrigin, listServerProjects, pairWithServer, pingConnection } from './service';

const BASE = 'http://127.0.0.1:15001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tokenFetch(token: string): ReturnType<typeof vi.fn<FetchLike>> {
  return vi.fn<FetchLike>(async () => jsonResponse({ token }));
}

function infoFetch(version = '2.0.24'): ReturnType<typeof vi.fn<FetchLike>> {
  return vi.fn<FetchLike>(async () => jsonResponse({ version }));
}

registerBuiltinBackends();

describe('pairWithServer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('redeems the code and stores the token without leaking it into the result', async () => {
    const fetchFn = tokenFetch('tok_live');
    setOpenCodeFetch(fetchFn);

    const result = await pairWithServer(' ABC123 ');

    expect(result).toEqual({ ok: true });
    expect(JSON.stringify(result)).not.toContain('tok_live');
    expect(await getToken()).toBe('tok_live');
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
  });

  it('uses the configured server URL', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });
    const fetchFn = tokenFetch('tok_live');
    setOpenCodeFetch(fetchFn);

    await pairWithServer('ABC123');

    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4096/auth/connect/ABC123');
  });

  it('stores nothing for a wrong or expired code', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(pairWithServer('WRONG')).resolves.toEqual({
      ok: false,
      error: 'That pairing code is wrong or expired',
    });
    expect(await getToken()).toBeNull();
  });

  it('stores nothing when the server is unreachable', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(pairWithServer('ABC123')).resolves.toEqual({
      ok: false,
      error: `Cannot reach the opencode server at ${BASE}`,
    });
    expect(await getToken()).toBeNull();
  });

  it('keeps an existing token when a re-pair fails', async () => {
    await setToken('tok_old');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ message: 'nope' }, 401)));

    await pairWithServer('WRONG');

    expect(await getToken()).toBe('tok_old');
  });

  it('asks for a code when none was entered', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pairWithServer('   ')).resolves.toEqual({ ok: false, error: 'Enter a pairing code' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('pingConnection', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('reports not paired before pairing', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pingConnection()).resolves.toEqual({ ok: false, detail: 'Not paired' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports ok right after a successful pairing', async () => {
    setOpenCodeFetch(tokenFetch('tok_live'));
    await pairWithServer('ABC123');

    setOpenCodeFetch(infoFetch('2.0.24'));

    await expect(pingConnection()).resolves.toEqual({ ok: true, detail: 'opencode 2.0.24' });
  });

  it('reports the failure detail when the server is unreachable', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(pingConnection()).resolves.toEqual({
      ok: false,
      detail: `Cannot reach the opencode server at ${BASE}`,
    });
  });
});

describe('listServerProjects', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('returns the mapped project list', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(
      vi.fn<FetchLike>(async () =>
        jsonResponse([{ id: 'proj_1', canonical: '/home/afif/example', time: {}, sandboxes: [] }]),
      ),
    );

    await expect(listServerProjects()).resolves.toEqual({
      ok: true,
      projects: [{ id: 'proj_1', name: 'example', directory: '/home/afif/example' }],
    });
  });

  it('returns an empty list honestly', async () => {
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse([])));

    await expect(listServerProjects()).resolves.toEqual({ ok: true, projects: [] });
  });

  it('returns an error when not paired', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>());

    await expect(listServerProjects()).resolves.toEqual({ ok: false, error: 'Not paired' });
  });
});

describe('bindOrigin', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('binds a page origin to a project directory', async () => {
    await expect(
      bindOrigin({ origin: 'https://example.com', projectDirectory: '/home/afif/example' }),
    ).resolves.toEqual({ ok: true });

    expect(await getOriginBindings()).toEqual({ 'https://example.com': '/home/afif/example' });
  });

  it('normalizes a full URL down to its origin', async () => {
    await bindOrigin({ origin: 'https://example.com/some/page?q=1', projectDirectory: '/home/afif/example' });

    expect(await getOriginBindings()).toEqual({ 'https://example.com': '/home/afif/example' });
  });

  it('refuses an unparseable origin', async () => {
    await expect(bindOrigin({ origin: 'not a url', projectDirectory: '/home/afif/example' })).resolves.toEqual({
      ok: false,
      error: 'That page has no bindable origin',
    });
    expect(await getOriginBindings()).toEqual({});
  });

  it('refuses a missing project', async () => {
    await expect(bindOrigin({ origin: 'https://example.com', projectDirectory: '  ' })).resolves.toEqual({
      ok: false,
      error: 'Pick a project first',
    });
    expect(await getOriginBindings()).toEqual({});
  });
});
