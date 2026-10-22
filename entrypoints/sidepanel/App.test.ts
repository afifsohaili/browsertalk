// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { acceptConsent, declineConsent, readConsentStatus } from '@/lib/consent/consent';
import { registerPanelHandler } from '@/lib/panel/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { setSettings } from '@/lib/storage/settings';
import App from './App.vue';

registerBuiltinBackends();

const PAGE_URL = 'https://example.com/cart';
const originalQuery = browser.tabs.query;

function triggerEvent(event: unknown, ...args: unknown[]): Promise<unknown> {
  return (event as { trigger: (...a: unknown[]) => Promise<unknown> }).trigger(...args);
}

function tab(url: string): Browser.tabs.Tab {
  return { id: 1, url } as unknown as Browser.tabs.Tab;
}

describe('side panel consent boundary', () => {
  let wrapper: VueWrapper | null = null;
  let query: MockInstance;
  let activatedAdds: MockInstance;
  let updatedAdds: MockInstance;
  let storageAdds: MockInstance;

  beforeAll(() => {
    registerBuiltinSessionStrategies();
  });

  beforeEach(async () => {
    fakeBrowser.reset();
    registerPanelHandler();
    registerConnectionHandler();
    await setSettings({ backendId: 'fake' });

    query = vi.fn(async () => [tab(PAGE_URL)]);
    browser.tabs.query = query as unknown as typeof browser.tabs.query;
    activatedAdds = vi.spyOn(browser.tabs.onActivated, 'addListener');
    updatedAdds = vi.spyOn(browser.tabs.onUpdated, 'addListener');
    storageAdds = vi.spyOn(browser.storage.local.onChanged, 'addListener');
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    browser.tabs.query = originalQuery;
    vi.restoreAllMocks();
  });

  function mountSidePanel(): VueWrapper {
    wrapper = mount(App);
    return wrapper;
  }

  function expectNoPanelReads(): void {
    expect(query).not.toHaveBeenCalled();
    expect(activatedAdds).not.toHaveBeenCalled();
    expect(updatedAdds).not.toHaveBeenCalled();
    expect(browser.tabs.onActivated.hasListeners()).toBe(false);
    expect(browser.tabs.onUpdated.hasListeners()).toBe(false);
  }

  function expectNoCaptureSurface(view: VueWrapper): void {
    expect(view.text()).not.toContain('Outbox');
    expect(view.text()).not.toContain('Point at element');
    expect(view.find('textarea').exists()).toBe(false);
    expect(view.text()).not.toContain('Send URL only');
  }

  it('reads nothing and subscribes to no panel events while consent is unset', async () => {
    const view = mountSidePanel();

    await vi.waitFor(() => expect(view.text()).toContain('Nothing is captured before you accept.'));

    expect(view.find('main.panel').exists()).toBe(false);
    expectNoPanelReads();
    expectNoCaptureSurface(view);
    expect(storageAdds, 'only the consent watcher may subscribe before acceptance').toHaveBeenCalledTimes(1);

    await triggerEvent(browser.storage.local.onChanged, { [STORAGE_KEYS.sessions]: { newValue: {} } });
    expect(query).not.toHaveBeenCalled();
  });

  it('reads nothing and subscribes to no panel events while consent is declined', async () => {
    await declineConsent();
    const view = mountSidePanel();

    await vi.waitFor(() => expect(view.text()).toContain('You declined.'));

    expect(view.find('main.panel').exists()).toBe(false);
    expectNoPanelReads();
    expectNoCaptureSurface(view);
    expect(storageAdds, 'only the consent watcher may subscribe before acceptance').toHaveBeenCalledTimes(1);

    await triggerEvent(browser.storage.local.onChanged, { [STORAGE_KEYS.sessions]: { newValue: {} } });
    expect(query).not.toHaveBeenCalled();
  });

  it('mounts the panel and reads the active page after acceptance', async () => {
    await acceptConsent();
    const view = mountSidePanel();

    await vi.waitFor(() => expect(view.find('main.panel').exists()).toBe(true));
    await vi.waitFor(() => expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true }));

    expect(activatedAdds).toHaveBeenCalledTimes(1);
    expect(updatedAdds).toHaveBeenCalledTimes(1);
    expect(browser.tabs.onActivated.hasListeners()).toBe(true);
    expect(browser.tabs.onUpdated.hasListeners()).toBe(true);
    await vi.waitFor(() => expect(view.text()).toContain('No project bound'));
    expect(view.text()).toContain('Outbox');
    expect(view.text()).toContain('Point at element');
    expect(view.find('textarea').attributes('placeholder')).toBe('What looks wrong?');
  });

  it('follows consent from another surface and drops the panel listeners on decline', async () => {
    await declineConsent();
    const view = mountSidePanel();
    await vi.waitFor(() => expect(view.text()).toContain('You declined.'));
    expectNoPanelReads();

    await browser.storage.local.set({ [STORAGE_KEYS.consent.status]: 'accepted' });
    await triggerEvent(browser.storage.local.onChanged, {
      [STORAGE_KEYS.consent.status]: { newValue: 'accepted' },
    });

    await vi.waitFor(() => expect(view.find('main.panel').exists()).toBe(true));
    await vi.waitFor(() => expect(query).toHaveBeenCalled());
    expect(browser.tabs.onActivated.hasListeners()).toBe(true);
    expect(browser.tabs.onUpdated.hasListeners()).toBe(true);

    await browser.storage.local.set({ [STORAGE_KEYS.consent.status]: 'declined' });
    await triggerEvent(browser.storage.local.onChanged, {
      [STORAGE_KEYS.consent.status]: { newValue: 'declined' },
    });

    await vi.waitFor(() => expect(view.find('main.panel').exists()).toBe(false));
    expect(browser.tabs.onActivated.hasListeners()).toBe(false);
    expect(browser.tabs.onUpdated.hasListeners()).toBe(false);

    const reads = query.mock.calls.length;
    await triggerEvent(browser.tabs.onActivated, { tabId: 2, windowId: 0 });
    await triggerEvent(browser.storage.local.onChanged, { [STORAGE_KEYS.sessions]: { newValue: {} } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(query).toHaveBeenCalledTimes(reads);
  });

  it('ignores a delayed accepted read that lands after a newer decline', async () => {
    await acceptConsent();

    type ReadStored = (keys?: unknown) => Promise<Record<string, unknown>>;
    const originalGet = browser.storage.local.get as unknown as ReadStored;
    let releaseAccepted: () => void = () => {};
    let acceptedStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      acceptedStarted = resolve;
    });
    let consentReads = 0;
    vi.spyOn(browser.storage.local, 'get').mockImplementation((async (keys?: unknown) => {
      if (keys === STORAGE_KEYS.consent.status && consentReads++ === 0) {
        acceptedStarted();
        await new Promise<void>((resolve) => {
          releaseAccepted = resolve;
        });
        return { [STORAGE_KEYS.consent.status]: 'accepted' };
      }
      return originalGet(keys);
    }) as unknown as typeof browser.storage.local.get);

    const view = mountSidePanel();
    await started;

    await browser.storage.local.set({ [STORAGE_KEYS.consent.status]: 'declined' });
    await triggerEvent(browser.storage.local.onChanged, {
      [STORAGE_KEYS.consent.status]: { newValue: 'declined' },
    });
    await vi.waitFor(() => expect(view.text()).toContain('You declined.'));
    expect(view.find('main.panel').exists()).toBe(false);

    releaseAccepted();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(view.find('main.panel').exists()).toBe(false);
    expectNoPanelReads();
    expect(await readConsentStatus()).toBe('declined');
  });
});
