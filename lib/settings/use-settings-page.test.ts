import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { resolveActiveSessionStrategy } from '@/lib/session-strategy/selection';
import { DEFAULT_SERVER_URL, getSettings } from '@/lib/storage/settings';
import { useSettingsPage, type SettingsPage } from './use-settings-page';

describe('settings page logic', () => {
  beforeAll(() => {
    registerBuiltinBackends();
    registerBuiltinSessionStrategies();
  });

  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadedPage(): Promise<SettingsPage> {
    const page = useSettingsPage();
    await vi.waitFor(() => {
      expect(page.loaded.value).toBe(true);
    });
    return page;
  }

  it('loads the honest defaults when nothing is stored', async () => {
    const page = await loadedPage();

    expect(page.backendId.value).toBe('opencode');
    expect(page.serverUrl.value).toBe(DEFAULT_SERVER_URL);
    expect(page.overrides.value).toEqual({});
  });

  it('offers the registered backends and strategies with labels', async () => {
    const page = await loadedPage();

    expect(page.backends).toEqual([
      { id: 'opencode', label: 'opencode', defaultStrategyLabel: 'Per-day' },
      { id: 'fake', label: 'Fake', defaultStrategyLabel: 'Per-day' },
    ]);
    expect(page.strategies).toEqual([
      { id: 'per-day', label: 'Per-day' },
      { id: 'sticky', label: 'Sticky' },
    ]);
  });

  it('persists the backend and the server URL', async () => {
    const page = await loadedPage();

    await page.saveBackendId('fake');
    page.serverUrl.value = 'http://127.0.0.1:4096';
    await page.saveServerUrl();

    expect(page.backendId.value).toBe('fake');
    expect(page.serverUrl.value).toBe('http://127.0.0.1:4096');
    expect(await getSettings()).toEqual({
      backendId: 'fake',
      serverUrl: 'http://127.0.0.1:4096',
      sessionStrategy: {},
    });
  });

  it('falls back to the default server URL when the field is emptied', async () => {
    const page = await loadedPage();

    page.serverUrl.value = '  ';
    await page.saveServerUrl();

    expect(page.serverUrl.value).toBe(DEFAULT_SERVER_URL);
    expect((await getSettings()).serverUrl).toBe(DEFAULT_SERVER_URL);
  });

  it('refuses a remote server URL with a clear error and keeps the stored value', async () => {
    const page = await loadedPage();

    page.serverUrl.value = 'https://example.com';
    await page.saveServerUrl();

    expect(page.error.value).toBe('The server must be on this machine — use localhost, 127.0.0.1, or ::1');
    expect((await getSettings()).serverUrl).toBe(DEFAULT_SERVER_URL);
  });

  it('refuses a server URL with embedded credentials', async () => {
    const page = await loadedPage();

    page.serverUrl.value = 'http://user:pass@127.0.0.1:15001';
    await page.saveServerUrl();

    expect(page.error.value).toBe('Remove the username and password from the server URL');
    expect((await getSettings()).serverUrl).toBe(DEFAULT_SERVER_URL);
  });

  it('shows the canonical endpoint after saving', async () => {
    const page = await loadedPage();

    page.serverUrl.value = '  http://127.0.0.1:15001/  ';
    await page.saveServerUrl();

    expect(page.error.value).toBeNull();
    expect(page.serverUrl.value).toBe('http://127.0.0.1:15001');
  });

  it('merges a strategy override without clobbering the other backends', async () => {
    const page = await loadedPage();

    await page.saveStrategyOverride('opencode', 'sticky');
    await page.saveStrategyOverride('fake', 'per-day');

    expect(page.overrides.value).toEqual({ opencode: 'sticky', fake: 'per-day' });
    expect((await getSettings()).sessionStrategy).toEqual({ opencode: 'sticky', fake: 'per-day' });
  });

  it('clearing an override falls back to the backend default on the next resolve', async () => {
    const page = await loadedPage();
    await page.saveBackendId('fake');

    await page.saveStrategyOverride('fake', 'sticky');
    expect((await resolveActiveSessionStrategy()).strategy.id).toBe('sticky');

    await page.saveStrategyOverride('fake', null);
    expect(page.overrides.value).toEqual({});
    expect((await resolveActiveSessionStrategy()).strategy.id).toBe('per-day');
  });

  it('surfaces a storage error instead of dropping it', async () => {
    const page = await loadedPage();
    vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('storage unavailable'));

    await page.saveBackendId('fake');

    expect(page.error.value).toBe('storage unavailable');
    expect(page.backendId.value).toBe('opencode');
  });

  it('surfaces a load error instead of leaving a blank page', async () => {
    vi.spyOn(browser.storage.local, 'get').mockRejectedValueOnce(new Error('storage unavailable'));

    const page = useSettingsPage();

    await vi.waitFor(() => {
      expect(page.error.value).toBe('storage unavailable');
    });
    expect(page.loaded.value).toBe(false);
  });
});
