import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import type { Project } from '@/lib/agent-backend/interface';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import {
  openCodeAuthHeader,
  resetOpenCodeFetch,
  setOpenCodeFetch,
  type FetchLike,
} from '@/lib/agent-backend/opencode-api';
import { SETUP_BADGE_TEXT } from '@/lib/onboarding/badge';
import { registerOnboardingHandler } from '@/lib/onboarding/install';
import { getToken, setToken } from '@/lib/storage/auth';
import { setSettings } from '@/lib/storage/settings';
import {
  onConnectionChanged,
  registerConnectionHandler,
  requestBind,
  requestConnectionStatus,
  requestOnboarding,
  requestPair,
  requestProjects,
  requestReset,
} from './messages';

const BASE = 'http://127.0.0.1:15001';
const BASE_B = 'http://127.0.0.1:4096';
const KEY = `opencode@${BASE}`;
const KEY_B = `opencode@${BASE_B}`;
const CONNECTION = { backendId: 'opencode', endpoint: BASE };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

registerBuiltinBackends();

describe('connection messaging', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('answers a status request', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' })));

    await expect(requestConnectionStatus()).resolves.toEqual({
      ok: false,
      detail: 'Not paired',
      state: 'unpaired',
      action: 'Pair with opencode',
      endpoint: BASE,
      version: '2.0.32',
    });
  });

  it('pairs through the background and stores the token', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    const response = await requestPair('ABC123');

    expect(response).toEqual({ ok: true });
    expect(JSON.stringify(response)).not.toContain('tok_live');
    expect(await getToken(KEY)).toBe('tok_live');
  });

  it('reports a pairing failure to the surface', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(requestPair('WRONG')).resolves.toEqual({
      ok: false,
      error: 'That pairing code is wrong or expired',
    });
    expect(await getToken(KEY)).toBeNull();
  });

  it('tells every open surface after a successful pairing', async () => {
    const listener = vi.fn();
    onConnectionChanged(listener);
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    await requestPair('ABC123');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not tell surfaces after a failed pairing', async () => {
    const listener = vi.fn();
    onConnectionChanged(listener);
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({}, 401)));

    await requestPair('WRONG');

    expect(listener).not.toHaveBeenCalled();
  });

  it('lists projects through the background', async () => {
    await setToken(KEY, 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse([{ id: 'p1', canonical: '/home/afif/x' }])));

    await expect(requestProjects(CONNECTION)).resolves.toEqual({
      ok: true,
      supported: true,
      projects: [{ id: 'p1', name: 'x', directory: '/home/afif/x' }],
    });
  });

  it('lists projects for the captured connection even when the settings point elsewhere', async () => {
    await setToken(KEY, 'tok_live');
    await setSettings({ serverUrl: BASE_B });
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse([{ id: 'p1', canonical: '/home/afif/x' }]));
    setOpenCodeFetch(fetchFn);

    await expect(requestProjects(CONNECTION)).resolves.toEqual({
      ok: true,
      supported: true,
      projects: [{ id: 'p1', name: 'x', directory: '/home/afif/x' }],
    });

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/project`);
    const headers = new Headers(fetchFn.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBe(openCodeAuthHeader('tok_live'));
  });

  it('delivers the backend onboarding copy for pairing', async () => {
    await expect(requestOnboarding()).resolves.toEqual({
      instructions: 'Run opencode pair in a terminal. Copy the link. Do not open it. Links expire in 5 minutes. Then paste the link or code.',
      command: 'opencode pair',
      credentialLabel: 'Pairing link or code',
    });
  });

  it('falls back to no onboarding when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestOnboarding()).resolves.toBeNull();
  });

  it('surfaces a project list failure honestly', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>());

    await expect(requestProjects(CONNECTION)).resolves.toEqual({ ok: false, error: 'Not paired' });
  });

  it('reports a malformed project list honestly', async () => {
    class JunkProjectsBackend extends FakeAgentBackend {
      override async listProjects(): Promise<Project[]> {
        return [{ id: 'p1', name: 'x' } as unknown as Project];
      }
    }
    registerAgentBackend('junk', () => new JunkProjectsBackend());

    await expect(requestProjects({ backendId: 'junk', endpoint: BASE })).resolves.toEqual({
      ok: false,
      error: 'The server sent a project list we could not read',
    });
  });

  it('leaves a malformed request for other modules', async () => {
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'connection/pair') {
        sendResponse('other module');
        return true;
      }
      return undefined;
    });

    await expect(browser.runtime.sendMessage({ type: 'connection/pair' })).resolves.toBe('other module');
  });

  it('binds an origin through the background under the captured connection', async () => {
    await setSettings({ serverUrl: BASE_B });

    await expect(requestBind('https://example.com', '/home/afif/example', CONNECTION)).resolves.toEqual({ ok: true });

    expect(await browser.storage.local.get('projects.byOrigin')).toEqual({
      'projects.byOrigin': { [KEY]: { 'https://example.com': '/home/afif/example' } },
    });
  });

  it('leaves messages for other modules alone', async () => {
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse('other module');
      return true;
    });

    await expect(browser.runtime.sendMessage({ type: 'picker/arm' })).resolves.toBe('other module');
  });

  it('reports a background failure in the surface shape', async () => {
    fakeBrowser.reset();
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse({ nope: true });
      return true;
    });

    await expect(requestConnectionStatus()).resolves.toEqual({ ok: false, detail: 'Background unavailable' });
  });

  it('falls back honestly when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestConnectionStatus()).resolves.toEqual({ ok: false, detail: 'Background unavailable' });
  });

  it('passes the remote confirmation back to the surface', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>());

    const response = await requestPair('http://100.64.0.5:4096/auth/connect/ABC123');

    expect(response).toMatchObject({ ok: false, remote: { origin: 'http://100.64.0.5:4096' } });
  });

  it('asks for the origin even when "Allow a remote server" is already on', async () => {
    await setSettings({ allowRemote: true });
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    const response = await requestPair('http://100.64.0.6:4096/auth/connect/ABC123');

    expect(response).toMatchObject({ ok: false, remote: { origin: 'http://100.64.0.6:4096' } });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await getToken('opencode@http://100.64.0.6:4096')).toBeNull();
  });

  it('forgets the pairing through the background', async () => {
    await setToken(KEY, 'tok_live');

    await expect(requestReset()).resolves.toEqual({ ok: true });
    expect(await getToken(KEY)).toBeNull();
  });

  it('pairs a remote link when the surface confirms it', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_remote' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    const response = await requestPair('http://100.64.0.5:4096/auth/connect/ABC123', { confirmRemote: true });

    expect(response).toEqual({ ok: true });
    expect(await getToken('fake@http://100.64.0.5:4096')).toBeNull();
    expect(await getToken('opencode@http://100.64.0.5:4096')).toBe('tok_remote');
  });
});

describe('connection status and the setup badge', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
  });

  afterEach(() => {
    resetOpenCodeFetch();
    vi.restoreAllMocks();
  });

  it('clears and restores the badge as the server comes up and drops', async () => {
    await setToken(KEY, 'tok_live');

    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: false, state: 'unreachable' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);

    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' })));
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: false, state: 'unreachable' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('restores the setup badge after a reset', async () => {
    await setToken(KEY, 'tok_live');
    await fakeBrowser.action.setBadgeText({ text: '' });

    await expect(requestReset()).resolves.toEqual({ ok: true });

    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('reports a reset error without changing the badge or the token', async () => {
    await setToken(KEY, 'tok_live');
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    await fakeBrowser.action.setBadgeText({ text: '' });

    await expect(requestReset()).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });

    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
    expect(await getToken(KEY)).toBe('tok_live');
  });

  it('keeps the badge clear when an older unreachable probe finishes after a newer connected one', async () => {
    await setToken(KEY, 'tok_live');
    await setToken(KEY_B, 'tok_b');

    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).startsWith(BASE_B)) return jsonResponse({ version: '2.0.32' });
      await staleGate;
      throw new TypeError('fetch failed');
    });
    setOpenCodeFetch(fetchFn);

    const stale = requestConnectionStatus();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());

    await setSettings({ serverUrl: BASE_B });
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    releaseStale();
    await expect(stale).resolves.toMatchObject({ state: 'unreachable' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('keeps the badge set when an older connected probe finishes after a newer unreachable one', async () => {
    await setToken(KEY, 'tok_live');
    await setToken(KEY_B, 'tok_b');

    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).startsWith(BASE_B)) throw new TypeError('fetch failed');
      await staleGate;
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);

    const stale = requestConnectionStatus();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());

    await setSettings({ serverUrl: BASE_B });
    await expect(requestConnectionStatus()).resolves.toMatchObject({ state: 'unreachable' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);

    releaseStale();
    await expect(stale).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('ignores an older status probe after a successful pair', async () => {
    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    let gateStatus = true;
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
      if (gateStatus) {
        await staleGate;
        throw new TypeError('fetch failed');
      }
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);

    const stale = requestConnectionStatus();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());

    gateStatus = false;
    await expect(requestPair('ABC123')).resolves.toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    releaseStale();
    await expect(stale).resolves.toMatchObject({ state: 'unreachable' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('ignores an older status probe after a reset', async () => {
    await setToken(KEY, 'tok_live');

    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async () => {
      await staleGate;
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);
    await fakeBrowser.action.setBadgeText({ text: '' });

    const stale = requestConnectionStatus();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());

    await expect(requestReset()).resolves.toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);

    releaseStale();
    await expect(stale).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('keeps the badge clear when a startup check fails after a newer connected one', async () => {
    registerOnboardingHandler();
    await setToken(KEY, 'tok_live');
    await setToken(KEY_B, 'tok_b');

    let releaseStartup!: () => void;
    const startupGate = new Promise<void>((resolve) => {
      releaseStartup = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).startsWith(BASE_B)) return jsonResponse({ version: '2.0.32' });
      await startupGate;
      throw new TypeError('fetch failed');
    });
    setOpenCodeFetch(fetchFn);

    const startup = fakeBrowser.runtime.onStartup.trigger();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    await setSettings({ serverUrl: BASE_B });
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    releaseStartup();
    await startup;
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('keeps the badge clear when a startup check finishes after the connection moved', async () => {
    registerOnboardingHandler();
    await setToken(KEY, 'tok_live');
    await setToken(KEY_B, 'tok_b');

    let releaseStartup!: () => void;
    const startupGate = new Promise<void>((resolve) => {
      releaseStartup = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async () => {
      await startupGate;
      throw new TypeError('fetch failed');
    });
    setOpenCodeFetch(fetchFn);

    const startup = fakeBrowser.runtime.onStartup.trigger();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    await setSettings({ serverUrl: BASE_B });

    releaseStartup();
    await startup;
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('ignores an older startup check after a successful pair', async () => {
    registerOnboardingHandler();
    await setToken(KEY, 'tok_live');

    let releaseStartup!: () => void;
    const startupGate = new Promise<void>((resolve) => {
      releaseStartup = resolve;
    });
    let gateStatus = true;
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
      if (gateStatus) {
        await startupGate;
        throw new TypeError('fetch failed');
      }
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);

    const startup = fakeBrowser.runtime.onStartup.trigger();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    gateStatus = false;
    await expect(requestPair('ABC123')).resolves.toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    releaseStartup();
    await startup;
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('ignores an older startup check after a reset', async () => {
    registerOnboardingHandler();
    await setToken(KEY, 'tok_live');

    let releaseStartup!: () => void;
    const startupGate = new Promise<void>((resolve) => {
      releaseStartup = resolve;
    });
    const fetchFn = vi.fn<FetchLike>(async () => {
      await startupGate;
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);
    await fakeBrowser.action.setBadgeText({ text: '' });

    const startup = fakeBrowser.runtime.onStartup.trigger();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    await expect(requestReset()).resolves.toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);

    releaseStartup();
    await startup;
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('keeps the badge clear when an obsolete reset finishes after another connection is connected', async () => {
    await setToken(KEY, 'tok_live');
    await setToken(KEY_B, 'tok_b');
    await fakeBrowser.action.setBadgeText({ text: '' });
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' })));

    const originalSet = browser.storage.local.set.bind(browser.storage.local);
    let releaseReset!: () => void;
    const resetGate = new Promise<void>((resolve) => {
      releaseReset = resolve;
    });
    let heldTokens = false;
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockImplementation(async (items) => {
      if (!heldTokens && 'auth.tokens' in (items as Record<string, unknown>)) {
        heldTokens = true;
        await resetGate;
      }
      return originalSet(items);
    });

    const reset = requestReset();
    await vi.waitFor(() => expect(heldTokens).toBe(true));

    await setSettings({ serverUrl: BASE_B });
    await expect(requestConnectionStatus()).resolves.toMatchObject({ ok: true, state: 'connected' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');

    releaseReset();
    await expect(reset).resolves.toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
    expect(await getToken(KEY_B)).toBe('tok_b');

    setSpy.mockRestore();
  });
});
