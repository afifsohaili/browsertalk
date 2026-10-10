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

  it('reports not paired without touching the network when no token is stored', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    const status = await new OpenCodeBackend().ping();

    expect(status).toEqual({ ok: false, detail: 'Not paired' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports the server version with a stored token', async () => {
    await setToken(TOKEN_KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' })));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({ ok: true, detail: 'opencode 2.0.24' });
  });

  it('reports a rejected token', async () => {
    await setToken(TOKEN_KEY, 'stale');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'Pairing token rejected',
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
    });
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(new OpenCodeBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('prefers explicit config over storage', async () => {
    await setToken(TOKEN_KEY, 'stale');
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '9.9.9' }));
    const backend = new OpenCodeBackend({ baseUrl: 'http://127.0.0.1:4096', token: 'tok_explicit', fetchFn });

    await expect(backend.ping()).resolves.toEqual({ ok: true, detail: 'opencode 9.9.9' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('http://127.0.0.1:4096/api/info');
    expect(call?.[1]?.headers).toEqual({ Authorization: 'Basic b3BlbmNvZGU6dG9rX2V4cGxpY2l0' });
  });

  it('sends no token when the config explicitly has none', async () => {
    await setToken(TOKEN_KEY, 'tok_stored');
    const fetchFn = vi.fn<FetchLike>();
    const backend = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn });

    await expect(backend.ping()).resolves.toEqual({ ok: false, detail: 'Not paired' });
    expect(fetchFn).not.toHaveBeenCalled();
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

describe('OpenCodeBackend.onboarding', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('exchanges the credential through the configured endpoint', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ token: 'tok_new' }));
    const onboarding = new OpenCodeBackend({ baseUrl: BASE, token: null, fetchFn }).onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    await expect(onboarding.authenticate({ credential: 'ABC123' })).resolves.toEqual({ token: 'tok_new' });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
  });

  it('names the pairing command with the configured endpoint', () => {
    const onboarding = new OpenCodeBackend().onboarding;
    if (onboarding === null) throw new Error('expected onboarding');

    expect(onboarding.credentialLabel).toBe('Pairing code');
    expect(onboarding.emptyCredentialError).toBe('Enter a pairing code');
    expect(onboarding.instructions({ endpoint: BASE })).toBe('Run this on the server, then paste the code:');
    expect(onboarding.command({ endpoint: 'http://127.0.0.1:4096' })).toBe(
      'opencode api post /api/pair --server http://127.0.0.1:4096',
    );
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
        files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
      }),
    ).resolves.toEqual({ messageID: 'msg_1' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/session/ses_abc/prompt`);
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      text: '## Browser feedback — example',
      delivery: 'queue',
      files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
    });
  });

  it('fails with a clear error when not paired', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().sendFeedback({ sessionID: 'ses_abc', text: 'x', delivery: 'queue' }),
    ).rejects.toThrow('Not paired');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a stored non-loopback server URL without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      new OpenCodeBackend().sendFeedback({ sessionID: 'ses_abc', text: 'x', delivery: 'queue' }),
    ).rejects.toThrow('The server must be on this machine');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
