import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { SETUP_BADGE_TEXT } from './badge';
import { registerOnboardingHandler } from './install';

registerBuiltinBackends();

function installedAs(installType: 'development' | 'normal' | 'admin'): void {
  vi.spyOn(browser.management, 'getSelf').mockResolvedValue({ installType } as never);
}

async function welcomeUrls(): Promise<string[]> {
  const tabs = await fakeBrowser.tabs.query({});
  return tabs.map((tab) => tab.url ?? '').filter((url) => url.endsWith('/welcome.html'));
}

const WELCOME_URL = 'chrome-extension://test-extension-id/welcome.html';

describe('install gating', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerOnboardingHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the welcome tab and sets the badge on a normal install', async () => {
    installedAs('normal');

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    expect(await welcomeUrls()).toEqual([WELCOME_URL]);
    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('does not open the welcome tab on an update', async () => {
    installedAs('normal');

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update' } as never);

    expect(await welcomeUrls()).toEqual([]);
  });

  it.each(['development', 'admin'] as const)('skips a %s install', async (installType) => {
    installedAs(installType);

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    expect(await welcomeUrls()).toEqual([]);
  });

  it('opens the welcome tab when the install type is unavailable', async () => {
    vi.spyOn(browser.management, 'getSelf').mockRejectedValue(new Error('management unavailable'));

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    expect(await welcomeUrls()).toEqual([WELCOME_URL]);
  });
});
