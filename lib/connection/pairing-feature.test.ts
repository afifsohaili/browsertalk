import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { getToken, setToken } from '@/lib/storage/auth';
import { setSettings, getSettings } from '@/lib/storage/settings';
import { listServerProjects, pairWithServer, pingConnection, resetConnection } from './service';

const LINK_ENDPOINT = 'http://127.0.0.1:29422';
const LINK_KEY = `opencode@${LINK_ENDPOINT}`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const PAIR_OUTPUT = [
  'Running opencode pair',
  '',
  'Copy this link. Do not open it. It expires in 5 minutes.',
  `${LINK_ENDPOINT}/auth/connect/9f2c1a4b`,
].join('\n');

registerBuiltinBackends();

describe('pairing from an opencode pair link', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('stores the token under the link endpoint and reaches a working project list', async () => {
    const calls: string[] = [];
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        const href = String(url);
        calls.push(href);
        if (href.endsWith('/auth/connect/9f2c1a4b')) return jsonResponse({ token: 'tok_link' });
        if (href.endsWith('/api/info')) return jsonResponse({ version: '2.0.32' });
        if (href.endsWith('/api/project')) {
          return jsonResponse([{ id: 'proj_1', canonical: '/home/afif/example' }]);
        }
        return jsonResponse({}, 500);
      }),
    );

    await expect(pairWithServer(PAIR_OUTPUT)).resolves.toEqual({ ok: true });

    expect((await getSettings()).serverUrl).toBe(LINK_ENDPOINT);
    expect((await getSettings()).allowRemote).toBe(false);
    expect(await getToken(LINK_KEY)).toBe('tok_link');

    await expect(pingConnection()).resolves.toEqual({
      ok: true,
      detail: 'opencode 2.0.32',
      state: 'connected',
      action: 'Pick a project',
      endpoint: LINK_ENDPOINT,
      version: '2.0.32',
    });

    await expect(listServerProjects({ backendId: 'opencode', endpoint: LINK_ENDPOINT })).resolves.toEqual({
      ok: true,
      supported: true,
      projects: [{ id: 'proj_1', name: 'example', directory: '/home/afif/example' }],
    });
    expect(calls[0]).toBe(`${LINK_ENDPOINT}/auth/connect/9f2c1a4b`);
  });

  it('keeps the saved endpoint when a bare code is pasted', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_code' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    await expect(pairWithServer('ABC123')).resolves.toEqual({ ok: true });

    expect((await getSettings()).serverUrl).toBe('http://127.0.0.1:4096');
    expect(await getToken('opencode@http://127.0.0.1:4096')).toBe('tok_code');
  });

  it('rejects a non-2.x server without persisting the link or the token', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_link' });
        return jsonResponse({ version: '3.0.0' });
      }),
    );

    await expect(pairWithServer(PAIR_OUTPUT)).resolves.toEqual({
      ok: false,
      error: 'Browsertalk needs opencode 2 — run opencode upgrade',
    });

    expect((await getSettings()).serverUrl).toBe('http://127.0.0.1:15001');
    expect(await getToken(LINK_KEY)).toBeNull();
  });

  it('rejects a malformed version after redemption without persisting anything', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_link' });
        return jsonResponse({ version: '2.garbage' });
      }),
    );

    await expect(pairWithServer(PAIR_OUTPUT)).resolves.toEqual({
      ok: false,
      error: 'Browsertalk needs opencode 2 — run opencode upgrade',
    });

    expect(await getSettings()).toMatchObject({ serverUrl: 'http://127.0.0.1:15001', allowRemote: false });
    expect(await getToken(LINK_KEY)).toBeNull();
  });

  it('keeps the saved settings and token when the version lookup fails after redemption', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_link' });
        throw new TypeError('fetch failed');
      }),
    );

    await expect(pairWithServer(PAIR_OUTPUT)).resolves.toEqual({
      ok: false,
      error: `Cannot reach the opencode server at ${LINK_ENDPOINT}`,
    });

    expect(await getSettings()).toMatchObject({ serverUrl: 'http://127.0.0.1:15001', allowRemote: false });
    expect(await getToken(LINK_KEY)).toBeNull();
    expect(await getToken(`opencode@http://127.0.0.1:15001`)).toBeNull();
  });
});

describe('pairing from a remote link', () => {
  const REMOTE = 'http://100.64.0.5:4096';
  const REMOTE_LINK = `${REMOTE}/auth/connect/remote123`;
  const REMOTE_KEY = `opencode@${REMOTE}`;
  const WARNING =
    'This link points to a server on another machine. The pairing token and feedback will cross your network. Keep the path encrypted (Tailscale, SSH tunnel) or trusted.';

  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('asks before pairing and persists nothing on cancel', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(pairWithServer(REMOTE_LINK)).resolves.toEqual({
      ok: false,
      error: WARNING,
      remote: { origin: REMOTE, warning: WARNING },
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await getSettings()).toMatchObject({
      serverUrl: 'http://127.0.0.1:15001',
      allowRemote: false,
    });
    expect(await getToken(REMOTE_KEY)).toBeNull();
  });

  it('pairs the remote link once the user confirms, and turns the remote option on', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_remote' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    await expect(pairWithServer(REMOTE_LINK, { confirmRemote: true })).resolves.toEqual({ ok: true });

    expect(await getSettings()).toMatchObject({ serverUrl: REMOTE, allowRemote: true });
    expect(await getToken(REMOTE_KEY)).toBe('tok_remote');
  });

  it('asks for each remote link even when "Allow a remote server" is already on', async () => {
    const remoteA = 'http://100.64.0.5:4096';
    const remoteB = 'http://100.64.0.6:4096';
    const linkA = `${remoteA}/auth/connect/remoteA`;
    const linkB = `${remoteB}/auth/connect/remoteB`;
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      const href = String(url);
      if (href.endsWith('/auth/connect/remoteA')) return jsonResponse({ token: 'tok_a' });
      if (href.endsWith('/auth/connect/remoteB')) return jsonResponse({ token: 'tok_b' });
      return jsonResponse({ version: '2.0.32' });
    });
    setOpenCodeFetch(fetchFn);
    await setSettings({ allowRemote: true });

    await expect(pairWithServer(linkA)).resolves.toEqual({
      ok: false,
      error: WARNING,
      remote: { origin: remoteA, warning: WARNING },
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await getToken(`opencode@${remoteA}`)).toBeNull();

    await expect(pairWithServer(linkA, { confirmRemote: true })).resolves.toEqual({ ok: true });
    expect(await getToken(`opencode@${remoteA}`)).toBe('tok_a');
    expect(await getSettings()).toMatchObject({ serverUrl: remoteA, allowRemote: true });

    const callsAfterA = fetchFn.mock.calls.length;

    await expect(pairWithServer(linkB)).resolves.toEqual({
      ok: false,
      error: WARNING,
      remote: { origin: remoteB, warning: WARNING },
    });
    expect(fetchFn).toHaveBeenCalledTimes(callsAfterA);
    expect(await getSettings()).toMatchObject({ serverUrl: remoteA, allowRemote: true });
    expect(await getToken(`opencode@${remoteB}`)).toBeNull();

    await expect(pairWithServer(linkB, { confirmRemote: true })).resolves.toEqual({ ok: true });
    expect(await getToken(`opencode@${remoteB}`)).toBe('tok_b');
    expect(await getSettings()).toMatchObject({ serverUrl: remoteB, allowRemote: true });
    expect(fetchFn.mock.calls.some(([url]) => String(url) === `${remoteB}/auth/connect/remoteB`)).toBe(true);
  });

  it('keeps an existing token and settings when a confirmed pairing fails', async () => {
    await setToken(REMOTE_KEY, 'tok_old');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await pairWithServer(REMOTE_LINK, { confirmRemote: true });

    expect(await getToken(REMOTE_KEY)).toBe('tok_old');
    expect(await getSettings()).toMatchObject({ serverUrl: 'http://127.0.0.1:15001', allowRemote: false });
  });
});

describe('forgetting a pairing', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('clears the token for the current endpoint and returns to unpaired', async () => {
    await setToken(LINK_KEY, 'tok_link');
    await setSettings({ serverUrl: LINK_ENDPOINT });
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' })));

    await expect(pingConnection()).resolves.toMatchObject({ ok: true, state: 'connected' });

    await expect(resetConnection()).resolves.toEqual({ ok: true });

    expect(await getToken(LINK_KEY)).toBeNull();
    await expect(pingConnection()).resolves.toMatchObject({ ok: false, state: 'unpaired' });
  });

  it('keeps the token for another endpoint', async () => {
    await setToken(LINK_KEY, 'tok_link');
    await setToken('opencode@http://127.0.0.1:4096', 'tok_other');
    await setSettings({ serverUrl: LINK_ENDPOINT });

    await resetConnection();

    expect(await getToken(LINK_KEY)).toBeNull();
    expect(await getToken('opencode@http://127.0.0.1:4096')).toBe('tok_other');
  });
});
