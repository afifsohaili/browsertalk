import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { getToken, setToken } from '@/lib/storage/auth';
import {
  onConnectionChanged,
  registerConnectionHandler,
  requestBind,
  requestConnectionStatus,
  requestPair,
  requestProjects,
} from './messages';

const BASE = 'http://127.0.0.1:15001';

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
    setOpenCodeFetch(vi.fn<FetchLike>());

    await expect(requestConnectionStatus()).resolves.toEqual({ ok: false, detail: 'Not paired' });
  });

  it('pairs through the background and stores the token', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ token: 'tok_live' })));

    const response = await requestPair('ABC123');

    expect(response).toEqual({ ok: true });
    expect(JSON.stringify(response)).not.toContain('tok_live');
    expect(await getToken()).toBe('tok_live');
  });

  it('reports a pairing failure to the surface', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    await expect(requestPair('WRONG')).resolves.toEqual({
      ok: false,
      error: 'That pairing code is wrong or expired',
    });
    expect(await getToken()).toBeNull();
  });

  it('tells every open surface after a successful pairing', async () => {
    const listener = vi.fn();
    onConnectionChanged(listener);
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ token: 'tok_live' })));

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
    await setToken('tok_live');
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse([{ id: 'p1', canonical: '/home/afif/x' }])));

    await expect(requestProjects()).resolves.toEqual({
      ok: true,
      projects: [{ id: 'p1', name: 'x', directory: '/home/afif/x' }],
    });
  });

  it('surfaces a project list failure honestly', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>());

    await expect(requestProjects()).resolves.toEqual({ ok: false, error: 'Not paired' });
  });

  it('binds an origin through the background', async () => {
    await expect(requestBind('https://example.com', '/home/afif/example')).resolves.toEqual({ ok: true });

    expect(await browser.storage.local.get('projects.byOrigin')).toEqual({
      'projects.byOrigin': { 'https://example.com': '/home/afif/example' },
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
});
