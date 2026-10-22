import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { setSettings } from '@/lib/storage/settings';
import { applySetupBadge, SETUP_BADGE_TEXT } from './badge';
import { registerOnboardingHandler } from './install';

registerBuiltinBackends();

describe('setup badge', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    resetOpenCodeFetch();
    vi.restoreAllMocks();
  });

  it('sets the badge while the connection is not ready', async () => {
    await applySetupBadge({ ok: false, detail: 'Not paired', state: 'unpaired' });

    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('clears the badge when the connection is ready', async () => {
    await fakeBrowser.action.setBadgeText({ text: SETUP_BADGE_TEXT });

    await applySetupBadge({ ok: true, detail: 'opencode 2.0.32', state: 'connected' });

    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });

  it('restores the badge on startup when the server is unreachable', async () => {
    registerOnboardingHandler();
    setOpenCodeFetch(
      vi.fn<FetchLike>(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    await fakeBrowser.runtime.onStartup.trigger();

    expect(await fakeBrowser.action.getBadgeText({})).toBe(SETUP_BADGE_TEXT);
  });

  it('leaves the badge clear on startup when the connection is ready', async () => {
    registerOnboardingHandler();
    await setSettings({ backendId: 'fake' });

    await fakeBrowser.runtime.onStartup.trigger();

    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
  });
});
