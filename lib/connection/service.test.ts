import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type { BackendOnboarding } from '@/lib/agent-backend/interface';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { getToken, setToken } from '@/lib/storage/auth';
import { getOriginBindings } from '@/lib/storage/projects';
import { setSettings } from '@/lib/storage/settings';
import { bindOrigin, connectionOnboarding, listServerProjects, pairWithServer, pingConnection } from './service';

const BASE = 'http://127.0.0.1:15001';
const KEY = `opencode@${BASE}`;
const KEY_4096 = 'opencode@http://127.0.0.1:4096';

class NoProjectsBackend extends FakeAgentBackend {
  override readonly capabilities = {
    projects: false,
    namedCreation: false,
    delivery: ['queue'] as const,
    images: false,
  };

  override async listProjects(): Promise<never> {
    throw new Error('listProjects must not be called');
  }
}

class BridgeBackend extends FakeAgentBackend {
  readonly credentials: string[] = [];

  override readonly onboarding: BackendOnboarding = {
    credentialLabel: 'Bridge token',
    emptyCredentialError: 'Enter the bridge token',
    instructions: ({ endpoint }) => `Paste the bridge token for ${endpoint}`,
    command: () => null,
    authenticate: async (input) => {
      this.credentials.push(input.credential);
      return { token: `tok_${input.credential}` };
    },
  };
}

const bridge = new BridgeBackend();

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

beforeAll(() => {
  registerAgentBackend('no-projects', () => new NoProjectsBackend());
  registerAgentBackend('bridge', () => bridge);
});

describe('pairWithServer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    bridge.credentials.length = 0;
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
    expect(await getToken(KEY)).toBe('tok_live');
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
  });

  it('uses the configured server URL and scopes the token to that connection', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });
    const fetchFn = tokenFetch('tok_live');
    setOpenCodeFetch(fetchFn);

    await pairWithServer('ABC123');

    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4096/auth/connect/ABC123');
    expect(await getToken(KEY_4096)).toBe('tok_live');
    expect(await getToken(KEY)).toBeNull();
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pairWithServer('ABC123')).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stores nothing for a wrong or expired code', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(pairWithServer('WRONG')).resolves.toEqual({
      ok: false,
      error: 'That pairing code is wrong or expired',
    });
    expect(await getToken(KEY)).toBeNull();
  });

  it('stores nothing when the server is unreachable', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(pairWithServer('ABC123')).resolves.toEqual({
      ok: false,
      error: `Cannot reach the opencode server at ${BASE}`,
    });
    expect(await getToken(KEY)).toBeNull();
  });

  it('keeps an existing token when a re-pair fails', async () => {
    await setToken(KEY, 'tok_old');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ message: 'nope' }, 401)));

    await pairWithServer('WRONG');

    expect(await getToken(KEY)).toBe('tok_old');
  });

  it('asks for a code when none was entered', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pairWithServer('   ')).resolves.toEqual({ ok: false, error: 'Enter a pairing code' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('dispatches the credential exchange to the selected backend', async () => {
    await setSettings({ backendId: 'bridge' });

    await expect(pairWithServer(' bridge-tok ')).resolves.toEqual({ ok: true });

    expect(bridge.credentials).toEqual(['bridge-tok']);
    expect(await getToken(`bridge@${BASE}`)).toBe('tok_bridge-tok');
  });

  it('uses the backend empty-credential copy', async () => {
    await setSettings({ backendId: 'bridge' });

    await expect(pairWithServer('   ')).resolves.toEqual({ ok: false, error: 'Enter the bridge token' });
    expect(bridge.credentials).toEqual([]);
  });

  it('reports a backend that needs no pairing', async () => {
    await setSettings({ backendId: 'fake' });

    await expect(pairWithServer('anything')).resolves.toEqual({
      ok: false,
      error: 'This backend needs no pairing',
    });
  });
});

describe('connectionOnboarding', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('renders the opencode pairing command for the configured endpoint', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });

    await expect(connectionOnboarding()).resolves.toEqual({
      ok: true,
      onboarding: {
        instructions: 'Run this on the server, then paste the code:',
        command: 'opencode api post /api/pair --server http://127.0.0.1:4096',
        credentialLabel: 'Pairing code',
      },
    });
  });

  it('renders backend-specific copy when the backend defines its own onboarding', async () => {
    await setSettings({ backendId: 'bridge' });

    await expect(connectionOnboarding()).resolves.toEqual({
      ok: true,
      onboarding: {
        instructions: `Paste the bridge token for ${BASE}`,
        command: null,
        credentialLabel: 'Bridge token',
      },
    });
  });

  it('reports no onboarding for a backend that needs no credential', async () => {
    await setSettings({ backendId: 'fake' });

    await expect(connectionOnboarding()).resolves.toEqual({ ok: true, onboarding: null });
  });

  it('refuses a stored non-loopback server URL', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });

    await expect(connectionOnboarding()).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });
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
    await setToken(KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(pingConnection()).resolves.toEqual({
      ok: false,
      detail: `Cannot reach the opencode server at ${BASE}`,
    });
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pingConnection()).resolves.toEqual({
      ok: false,
      detail: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('listServerProjects', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('returns the mapped project list for the captured connection', async () => {
    await setToken(KEY, 'tok_live');
    setOpenCodeFetch(
      vi.fn<FetchLike>(async () =>
        jsonResponse([{ id: 'proj_1', canonical: '/home/afif/example', time: {}, sandboxes: [] }]),
      ),
    );

    await expect(listServerProjects({ backendId: 'opencode', endpoint: BASE })).resolves.toEqual({
      ok: true,
      supported: true,
      projects: [{ id: 'proj_1', name: 'example', directory: '/home/afif/example' }],
    });
  });

  it('returns an empty list honestly', async () => {
    await setToken(KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse([])));

    await expect(listServerProjects({ backendId: 'opencode', endpoint: BASE })).resolves.toEqual({
      ok: true,
      supported: true,
      projects: [],
    });
  });

  it('reports unsupported discovery without asking the backend to list', async () => {
    await expect(listServerProjects({ backendId: 'no-projects', endpoint: BASE })).resolves.toEqual({
      ok: true,
      supported: false,
      projects: [],
    });
  });

  it('returns an error when not paired', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>());

    await expect(listServerProjects({ backendId: 'opencode', endpoint: BASE })).resolves.toEqual({
      ok: false,
      error: 'Not paired',
    });
  });

  it('refuses a non-loopback captured endpoint without touching the network', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(listServerProjects({ backendId: 'opencode', endpoint: 'https://example.com' })).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('bindOrigin', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('binds a page origin to a project directory under the captured connection', async () => {
    await expect(
      bindOrigin({
        origin: 'https://example.com',
        projectDirectory: '/home/afif/example',
        connection: { backendId: 'opencode', endpoint: BASE },
      }),
    ).resolves.toEqual({ ok: true });

    expect(await getOriginBindings(KEY)).toEqual({ 'https://example.com': '/home/afif/example' });
    expect(await getOriginBindings(KEY_4096)).toEqual({});
  });

  it('binds under the captured connection even when the settings point elsewhere', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });

    await expect(
      bindOrigin({
        origin: 'https://example.com',
        projectDirectory: '/home/afif/example',
        connection: { backendId: 'opencode', endpoint: BASE },
      }),
    ).resolves.toEqual({ ok: true });

    expect(await getOriginBindings(KEY)).toEqual({ 'https://example.com': '/home/afif/example' });
    expect(await getOriginBindings(KEY_4096)).toEqual({});
  });

  it('normalizes a full URL down to its origin', async () => {
    await bindOrigin({
      origin: 'https://example.com/some/page?q=1',
      projectDirectory: '/home/afif/example',
      connection: { backendId: 'opencode', endpoint: BASE },
    });

    expect(await getOriginBindings(KEY)).toEqual({ 'https://example.com': '/home/afif/example' });
  });

  it('refuses an unparseable origin', async () => {
    await expect(
      bindOrigin({
        origin: 'not a url',
        projectDirectory: '/home/afif/example',
        connection: { backendId: 'opencode', endpoint: BASE },
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'That page has no bindable origin',
    });
    expect(await getOriginBindings(KEY)).toEqual({});
  });

  it('refuses a missing project', async () => {
    await expect(
      bindOrigin({
        origin: 'https://example.com',
        projectDirectory: '  ',
        connection: { backendId: 'opencode', endpoint: BASE },
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'Pick a project first',
    });
    expect(await getOriginBindings(KEY)).toEqual({});
  });

  it('refuses a non-loopback captured endpoint', async () => {
    await expect(
      bindOrigin({
        origin: 'https://example.com',
        projectDirectory: '/home/afif/example',
        connection: { backendId: 'opencode', endpoint: 'https://example.com' },
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });
    expect(await browser.storage.local.get('projects.byOrigin')).toEqual({});
  });
});
