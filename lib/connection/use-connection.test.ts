import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { getToken, setToken } from '@/lib/storage/auth';
import { getSettings, setSettings } from '@/lib/storage/settings';
import { registerConnectionHandler } from './messages';
import { REMOTE_PAIRING_WARNING } from './status';
import { useConnection } from './use-connection';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

class GatedPingBackend extends FakeAgentBackend {
  readonly pings: number[] = [];
  private releases: Array<() => void> = [];

  override async ping(): Promise<BackendStatus> {
    this.pings.push(1);
    await new Promise<void>((resolve) => this.releases.push(resolve));
    return { ok: true, detail: 'gated backend' };
  }

  release(): void {
    this.releases.shift()?.();
  }
}

registerBuiltinBackends();

describe('useConnection', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
  });

  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('shows the connection turning ok after pairing without a reload', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        const href = url.toString();
        if (href.includes('/auth/connect/')) return jsonResponse({ token: 'tok_live' });
        if (href.endsWith('/api/info')) return jsonResponse({ version: '2.0.24' });
        return jsonResponse({}, 500);
      }),
    );

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({
        ok: false,
        detail: 'Not paired',
        state: 'unpaired',
      });
    });

    await expect(connection.pair('ABC123')).resolves.toBe(true);
    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({
        ok: true,
        detail: 'opencode 2.0.24',
        state: 'connected',
      });
    });

    scope.stop();
  });

  it('keeps the surface error from a failed pairing', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await expect(connection.pair('WRONG')).resolves.toBe(false);
    expect(connection.pairError.value).toBe('That pairing code is wrong or expired');
    expect(connection.status.value).toMatchObject({ ok: false, detail: 'Not paired', state: 'unpaired' });

    scope.stop();
  });

  it('exposes the backend onboarding copy for the pairing hint', async () => {
    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.onboarding.value).toEqual({
        instructions: 'Run opencode pair in a terminal. Copy the link. Do not open it. Links expire in 5 minutes. Then paste the link or code.',
        command: 'opencode pair',
        credentialLabel: 'Pairing link or code',
      });
    });

    scope.stop();
  });

  it('reports no onboarding for a backend that needs no credential', async () => {
    await setSettings({ backendId: 'fake' });

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.status.value).toEqual({ ok: true, detail: 'fake backend' });
    });
    expect(connection.onboarding.value).toBeNull();

    scope.stop();
  });

  it('reads the connection again when the backend changes', async () => {
    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({ ok: false, detail: 'Not paired' });
    });

    await setSettings({ backendId: 'fake' });

    await vi.waitFor(() => {
      expect(connection.status.value).toEqual({ ok: true, detail: 'fake backend' });
    });
    expect(connection.onboarding.value).toBeNull();

    scope.stop();
  });

  it('reads the connection again when the server URL changes', async () => {
    await setToken('opencode@http://127.0.0.1:15001', 'tok_a');
    await setToken('opencode@http://127.0.0.1:4096', 'tok_b');
    const calls: string[] = [];
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        calls.push(url.toString());
        return jsonResponse({ version: '2.0.24' });
      }),
    );

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({ ok: true, detail: 'opencode 2.0.24' });
    });
    expect(calls.some((url) => url.startsWith('http://127.0.0.1:15001'))).toBe(true);

    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });

    await vi.waitFor(() => {
      expect(calls.some((url) => url.startsWith('http://127.0.0.1:4096'))).toBe(true);
    });

    scope.stop();
  });

  it('discards a stale status result after the backend changed meanwhile', async () => {
    const gated = new GatedPingBackend();
    registerAgentBackend('gated', () => gated);
    await setSettings({ backendId: 'gated' });

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;
    await vi.waitFor(() => {
      expect(gated.pings).toHaveLength(1);
    });

    await setSettings({ backendId: 'fake' });
    await vi.waitFor(() => {
      expect(connection.status.value).toEqual({ ok: true, detail: 'fake backend' });
    });

    gated.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(connection.status.value).toEqual({ ok: true, detail: 'fake backend' });
    scope.stop();
  });

  it('holds a remote link until the user confirms or cancels', async () => {
    const remote = 'http://100.64.0.5:4096';
    const link = `${remote}/auth/connect/ABC123`;
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_remote' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await expect(connection.pair(link)).resolves.toBe(false);
    expect(connection.remoteConfirmation.value).toEqual({
      origin: remote,
      warning:
        'This link points to a server on another machine. The pairing token and feedback will cross your network. Keep the path encrypted (Tailscale, SSH tunnel) or trusted.',
    });
    expect(await getToken(`opencode@${remote}`)).toBeNull();

    connection.cancelRemote();
    expect(connection.remoteConfirmation.value).toBeNull();

    await expect(connection.pair(link)).resolves.toBe(false);
    await expect(connection.confirmRemote()).resolves.toBe(true);
    expect(connection.remoteConfirmation.value).toBeNull();
    expect(await getToken(`opencode@${remote}`)).toBe('tok_remote');

    scope.stop();
  });

  it('cancelling a remote link leaves settings and tokens untouched and makes confirm inert', async () => {
    const remote = 'http://100.64.0.5:4096';
    const link = `${remote}/auth/connect/ABC123`;
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401));
    setOpenCodeFetch(fetchFn);

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;
    await vi.waitFor(() => expect(connection.status.value).not.toBeNull());
    const callsBefore = fetchFn.mock.calls.length;
    const settingsBefore = await getSettings();

    await expect(connection.pair(link)).resolves.toBe(false);
    expect(connection.remoteConfirmation.value).not.toBeNull();

    connection.cancelRemote();

    expect(connection.remoteConfirmation.value).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(callsBefore);
    expect(await getSettings()).toEqual(settingsBefore);
    expect(await getToken(`opencode@${remote}`)).toBeNull();

    await expect(connection.confirmRemote()).resolves.toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(callsBefore);
    expect(await getSettings()).toEqual(settingsBefore);
    expect(await getToken(`opencode@${remote}`)).toBeNull();

    scope.stop();
  });

  it('holds each remote link: cancel keeps the old endpoint, confirm pairs the new one', async () => {
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

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;
    await vi.waitFor(() => expect(connection.status.value).not.toBeNull());

    await expect(connection.pair(linkA)).resolves.toBe(false);
    await expect(connection.confirmRemote()).resolves.toBe(true);
    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({ ok: true, state: 'connected' });
    });
    expect(await getToken(`opencode@${remoteA}`)).toBe('tok_a');

    const callsAfterA = fetchFn.mock.calls.length;

    await expect(connection.pair(linkB)).resolves.toBe(false);
    expect(connection.remoteConfirmation.value).toEqual({
      origin: remoteB,
      warning: REMOTE_PAIRING_WARNING,
    });
    expect(fetchFn).toHaveBeenCalledTimes(callsAfterA);
    expect(await getSettings()).toMatchObject({ serverUrl: remoteA, allowRemote: true });
    expect(await getToken(`opencode@${remoteB}`)).toBeNull();

    connection.cancelRemote();
    expect(connection.remoteConfirmation.value).toBeNull();
    expect(await getSettings()).toMatchObject({ serverUrl: remoteA, allowRemote: true });
    expect(await getToken(`opencode@${remoteA}`)).toBe('tok_a');
    expect(await getToken(`opencode@${remoteB}`)).toBeNull();

    await expect(connection.pair(linkB)).resolves.toBe(false);
    await expect(connection.confirmRemote()).resolves.toBe(true);
    expect(await getToken(`opencode@${remoteB}`)).toBe('tok_b');
    expect(await getSettings()).toMatchObject({ serverUrl: remoteB, allowRemote: true });
    expect(fetchFn.mock.calls.some(([url]) => String(url) === `${remoteB}/auth/connect/remoteB`)).toBe(true);

    scope.stop();
  });

  it('forgets the pairing and returns to unpaired', async () => {
    await setToken('opencode@http://127.0.0.1:15001', 'tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.32' })));

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;
    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({ ok: true, state: 'connected' });
    });

    await expect(connection.forget()).resolves.toBe(true);

    await vi.waitFor(() => {
      expect(connection.status.value).toMatchObject({ ok: false, state: 'unpaired' });
    });
    expect(await getToken('opencode@http://127.0.0.1:15001')).toBeNull();

    scope.stop();
  });
});
