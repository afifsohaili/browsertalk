import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { setSettings } from '@/lib/storage/settings';
import { registerConnectionHandler } from './messages';
import { useConnection } from './use-connection';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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
      expect(connection.status.value).toEqual({ ok: false, detail: 'Not paired' });
    });

    await expect(connection.pair('ABC123')).resolves.toBe(true);
    await vi.waitFor(() => {
      expect(connection.status.value).toEqual({ ok: true, detail: 'opencode 2.0.24' });
    });

    scope.stop();
  });

  it('keeps the surface error from a failed pairing', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await expect(connection.pair('WRONG')).resolves.toBe(false);
    expect(connection.pairError.value).toBe('That pairing code is wrong or expired');
    expect(connection.status.value).toEqual({ ok: false, detail: 'Not paired' });

    scope.stop();
  });

  it('exposes the backend onboarding copy for the pairing hint', async () => {
    const scope = effectScope();
    const connection = scope.run(() => useConnection())!;

    await vi.waitFor(() => {
      expect(connection.onboarding.value).toEqual({
        instructions: 'Run this on the server, then paste the code:',
        command: `opencode api post /api/pair --server http://127.0.0.1:15001`,
        credentialLabel: 'Pairing code',
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
});
