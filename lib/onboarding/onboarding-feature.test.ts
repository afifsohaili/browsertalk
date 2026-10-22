import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';
import { SETUP_BADGE_TEXT } from './badge';
import { registerOnboardingHandler } from './install';

registerBuiltinBackends();
registerBuiltinSessionStrategies();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function welcomeUrls(): Promise<string[]> {
  const tabs = await fakeBrowser.tabs.query({});
  return tabs.map((tab) => tab.url ?? '').filter((url) => url.endsWith('/welcome.html'));
}

const WELCOME_URL = 'chrome-extension://test-extension-id/welcome.html';

describe('onboarding on a fresh install', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
    registerOnboardingHandler();
    vi.spyOn(browser.management, 'getSelf').mockResolvedValue({ installType: 'normal' } as never);
  });

  afterEach(() => {
    resetOpenCodeFetch();
    vi.restoreAllMocks();
  });

  it('opens the welcome tab on install and leaves it closed on update', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    expect(await welcomeUrls()).toEqual([WELCOME_URL]);

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update' } as never);

    expect(await welcomeUrls()).toEqual([WELCOME_URL]);
  });

  it('clears the badge after a successful pair', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_link' });
        return jsonResponse({ version: '2.0.32' });
      }),
    );

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);

    const sendResponse = vi.fn();
    await fakeBrowser.runtime.onMessage.trigger(
      { type: 'connection/pair', code: 'ABC123' },
      {} as never,
      sendResponse,
    );

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse.mock.calls[0]?.[0]).toEqual({ ok: true });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });
});
