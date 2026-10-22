import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { setToken } from '@/lib/storage/auth';
import { setSettings } from '@/lib/storage/settings';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from './opencode-api';
import { OpenCodeBackend } from './opencode';

const BASE = 'http://127.0.0.1:15001';
const TOKEN_KEY = `opencode@${BASE}`;

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

  it('rejects an opencode 3 server with the upgrade action', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '3.0.0' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Browsertalk needs opencode 2',
      state: 'incompatible',
      action: 'Run opencode upgrade',
      endpoint: BASE,
      version: '3.0.0',
    });
  });

  it('rejects a malformed 2.x version with the upgrade action', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.garbage' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Browsertalk needs opencode 2',
      state: 'incompatible',
      action: 'Run opencode upgrade',
      endpoint: BASE,
      version: '2.garbage',
    });
  });

  it('reports not paired when an unauthenticated probe is rejected', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Not paired',
      state: 'unpaired',
      action: 'Pair with opencode',
      endpoint: BASE,
    });
  });

  it('probes without a token to tell a down server from an unpaired one', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' }));
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Not paired',
      state: 'unpaired',
      action: 'Pair with opencode',
      endpoint: BASE,
      version: '2.0.32',
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/info`);
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'application/json' });
  });

  it('reports an unreachable server when the unpaired probe fails to connect', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: `Cannot reach the opencode server at ${BASE}`,
      state: 'unreachable',
      action: 'Start opencode, then test again',
      endpoint: BASE,
    });
  });

  it('reports an incompatible server from the unpaired probe', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '3.0.0' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Browsertalk needs opencode 2',
      state: 'incompatible',
      action: 'Run opencode upgrade',
      endpoint: BASE,
      version: '3.0.0',
    });
  });

  it('reports the server version with a stored token', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: true,
      detail: 'opencode 2.0.24',
      state: 'connected',
      action: 'Pick a project',
      endpoint: BASE,
      version: '2.0.24',
    });
  });

  it('reports a rejected token', async () => {
    await setToken(TOKEN_KEY, 'stale');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Pairing token rejected',
      state: 'unauthorized',
      action: 'Pair again with a fresh link',
      endpoint: BASE,
    });
  });

  it('reports an unreachable server with its URL', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: `Cannot reach the opencode server at ${BASE}`,
      state: 'unreachable',
      action: 'Start opencode, then test again',
      endpoint: BASE,
    });
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
      state: 'unreachable',
      action: 'Fix the server URL in settings',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('prefers explicit config over storage', async () => {
    await setToken(TOKEN_KEY, 'stale');
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' }));
    const backend = new OpenCodeBackend({ baseUrl: 'http://127.0.0.1:4096', token: 'tok_explicit', fetchFn });

    await expect(backend.ping()).resolves.toEqual({
      ok: true,
      detail: 'opencode 2.0.24',
      state: 'connected',
      action: 'Pick a project',
      endpoint: 'http://127.0.0.1:4096',
      version: '2.0.24',
    });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('http://127.0.0.1:4096/api/info');
    expect(call?.[1]?.headers).toEqual({ Authorization: 'Basic b3BlbmNvZGU6dG9rX2V4cGxpY2l0' });
  });

  it('probes without a token when the config explicitly has none', async () => {
    await setToken(TOKEN_KEY, 'tok_stored');
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' }));
    const backend = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn });

    await expect(backend.ping()).resolves.toEqual({
      ok: false,
      detail: 'Not paired',
      state: 'unpaired',
      action: 'Pair with opencode',
      endpoint: BASE,
      version: '2.0.32',
    });
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'application/json' });
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
    await setToken('opencode@http://127.0.0.1:4096', 'tok_live');
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse([{ id: 'proj_1', canonical: '/home/afif/example', time: {}, sandboxes: [] }]),
    );
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'example', directory: '/home/afif/example' },
    ]);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4096/api/project');
  });

  it('does not pick up another endpoint token', async () => {
    await setToken('opencode@http://127.0.0.1:4096', 'tok_other');
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listProjects()).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns an empty list when the server knows no projects', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
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

describe('OpenCodeBackend.createSession', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('creates the session through the configured server', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse({ data: { id: 'ses_abc', title: 'Browsertalk · example · 2026-10-10' } }),
    );
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().createSession({
        directory: '/home/afif/example',
        title: 'Browsertalk · example · 2026-10-10',
        intent: { strategyId: 'per-day', strategyKey: '/home/afif/example::2026-10-10', generation: 0 },
      }),
    ).resolves.toEqual({ id: 'ses_abc', title: 'Browsertalk · example · 2026-10-10' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/session`);
    expect(call?.[1]?.method).toBe('POST');
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().createSession({
        directory: '/d',
        title: 'T',
        intent: { strategyId: 'per-day', strategyKey: '/d::2026-10-10', generation: 0 },
      }),
    ).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().createSession({
        directory: '/d',
        title: 'T',
        intent: { strategyId: 'per-day', strategyKey: '/d::2026-10-10', generation: 0 },
      }),
    ).rejects.toThrow('The server must be on this machine');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('OpenCodeBackend.listSessions', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('lists the project sessions through the configured server', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse({ data: [{ id: 'ses_abc', title: 'My review thread' }], cursor: {} }),
    );
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listSessions({ directory: '/home/afif/example', rootsOnly: true })).resolves.toEqual(
      [{ id: 'ses_abc', title: 'My review thread' }],
    );
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      `${BASE}/api/session?directory=%2Fhome%2Fafif%2Fexample&parentID=null&order=desc`,
    );
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().listSessions({ directory: '/d' })).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('OpenCodeBackend.getSession', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('reads the session through the configured server', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse({ data: { id: 'ses_abc', title: 'Renamed in the TUI' } }),
    );
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().getSession('ses_abc')).resolves.toEqual({
      id: 'ses_abc',
      title: 'Renamed in the TUI',
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/session/ses_abc`);
  });

  it('returns null for a session the server does not have', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'SessionNotFoundError' }, 404)));

    await expect(new OpenCodeBackend().getSession('ses_gone')).resolves.toBeNull();
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().getSession('ses_abc')).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('OpenCodeBackend.onboarding', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('exchanges the credential through the configured endpoint', async () => {
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
      return jsonResponse({ version: '2.0.32' });
    });
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(onboarding.authenticate({ credential: 'ABC123' })).resolves.toEqual({ token: 'tok_new' });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
  });

  it('rejects a malformed 2.x version after redeeming the code', async () => {
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
      return jsonResponse({ version: '2.garbage' });
    });
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(onboarding.authenticate({ credential: 'ABC123' })).rejects.toThrow(
      'Browsertalk needs opencode 2 — run opencode upgrade',
    );
  });

  it('gates a new pairing on an opencode 2 version', async () => {
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
      return jsonResponse({ version: '3.0.0' });
    });
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(onboarding.authenticate({ credential: 'ABC123' })).rejects.toThrow(
      'Browsertalk needs opencode 2 — run opencode upgrade',
    );
    expect(fetchFn.mock.calls[1]?.[0]).toBe(`${BASE}/api/info`);
  });

  it('accepts an opencode 2.x server and returns the token', async () => {
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
      return jsonResponse({ version: '2.0.32' });
    });
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(onboarding.authenticate({ credential: 'ABC123' })).resolves.toEqual({ token: 'tok_new' });
  });

  it('redeems and checks the endpoint carried by a pairing link', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      calls.push(String(url));
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_link' });
      return jsonResponse({ version: '2.0.32' });
    });
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(
      onboarding.authenticate({ credential: 'ABC123', endpoint: 'http://127.0.0.1:29422' }),
    ).resolves.toEqual({ token: 'tok_link', endpoint: 'http://127.0.0.1:29422' });
    expect(calls).toEqual([
      'http://127.0.0.1:29422/auth/connect/ABC123',
      'http://127.0.0.1:29422/api/info',
    ]);
  });

  it('names the pairing command with the configured endpoint', () => {
    const onboarding = new OpenCodeBackend().onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    expect(onboarding.credentialLabel).toBe('Pairing link or code');
    expect(onboarding.emptyCredentialError).toBe('Paste the pairing link or code');
    expect(onboarding.instructions({ endpoint: BASE })).toBe(
      'Run opencode pair in a terminal. Copy the link. Do not open it. Links expire in 5 minutes. Then paste the link or code.',
    );
    expect(onboarding.command({ endpoint: BASE })).toBe('opencode pair');
  });
});

describe('OpenCodeBackend.sendFeedback', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('sends the prompt with queue delivery and the attachment', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ data: { id: 'msg_1' } }));
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().sendFeedback({
        sessionID: 'ses_abc',
        text: '## Browser feedback — example',
        delivery: 'queue',
        requestID: 'req_1',
        files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
      }),
    ).resolves.toEqual({ admitted: true, messageID: 'msg_1' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/session/ses_abc/prompt`);
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      id: 'msg_req_1',
      text: '## Browser feedback — example',
      delivery: 'queue',
      files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
    });
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().sendFeedback({ sessionID: 'ses_abc', text: 'x', delivery: 'queue', requestID: 'req_1' }),
    ).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().sendFeedback({ sessionID: 'ses_abc', text: 'x', delivery: 'queue', requestID: 'req_1' }),
    ).rejects.toThrow('The server must be on this machine');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
