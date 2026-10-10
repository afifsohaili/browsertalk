import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_BACKEND_ID, DEFAULT_SERVER_URL, getSettings, setSettings } from './settings';

describe('settings storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to opencode on the loopback server when nothing is stored', async () => {
    expect(await getSettings()).toEqual({ backendId: DEFAULT_BACKEND_ID, serverUrl: DEFAULT_SERVER_URL });
  });

  it('returns stored values over the defaults', async () => {
    await browser.storage.local.set({
      'settings.backendId': 'fake',
      'settings.serverUrl': 'http://127.0.0.1:4096',
    });

    expect(await getSettings()).toEqual({ backendId: 'fake', serverUrl: 'http://127.0.0.1:4096' });
  });

  it('persists partial updates and keeps the other default', async () => {
    await setSettings({ serverUrl: 'http://127.0.0.1:4096' });

    expect(await getSettings()).toEqual({ backendId: DEFAULT_BACKEND_ID, serverUrl: 'http://127.0.0.1:4096' });
  });

  it('falls back to the defaults for junk values', async () => {
    await browser.storage.local.set({ 'settings.backendId': 'nope', 'settings.serverUrl': 42 });

    expect(await getSettings()).toEqual({ backendId: DEFAULT_BACKEND_ID, serverUrl: DEFAULT_SERVER_URL });
  });
});
