// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerPanelHandler } from '@/lib/panel/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { localDateKey } from '@/lib/session-strategy/per-day';
import { bindProject } from '@/lib/storage/projects';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { setSettings } from '@/lib/storage/settings';
import { writeStoredSession } from '@/lib/storage/writer';
import PanelSurface from './PanelSurface.vue';

const ORIGIN = 'https://example.com';
const PAGE_URL = `${ORIGIN}/cart`;
const KEY = 'fake@http://127.0.0.1:15001';
const DIRECTORY = '/tmp/fake-project';
const originalQuery = browser.tabs.query;

function tab(url: string): Browser.tabs.Tab {
  return { id: 1, url } as unknown as Browser.tabs.Tab;
}

function triggerEvent(event: unknown, ...args: unknown[]): Promise<unknown> {
  return (event as { trigger: (...a: unknown[]) => Promise<unknown> }).trigger(...args);
}

registerBuiltinBackends();
registerBuiltinSessionStrategies();

describe('panel arm picker target gate', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(async () => {
    fakeBrowser.reset();
    registerPanelHandler();
    registerConnectionHandler();
    await setSettings({ backendId: 'fake' });
    browser.tabs.query = vi.fn(async () => [tab(PAGE_URL)]) as unknown as typeof browser.tabs.query;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    browser.tabs.query = originalQuery;
    vi.restoreAllMocks();
  });

  function armButton(): ReturnType<VueWrapper['get']> {
    return wrapper!.get('.arm-picker button');
  }

  it('disables the picker until a project is bound', async () => {
    wrapper = mount(PanelSurface);

    await vi.waitFor(() => expect(wrapper!.text()).toContain('No project bound'));

    expect(armButton().attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Choose a project first');
  });

  it('keeps the picker disabled while the bound project has no session', async () => {
    await bindProject(KEY, ORIGIN, DIRECTORY);
    wrapper = mount(PanelSurface);

    await vi.waitFor(() => expect(wrapper!.text()).toContain('fake-project'));

    expect(armButton().attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Choose or start a session first');
  });

  it('enables the picker once a project and session are selected', async () => {
    await bindProject(KEY, ORIGIN, DIRECTORY);
    wrapper = mount(PanelSurface);
    await vi.waitFor(() => expect(wrapper!.text()).toContain('fake-project'));
    expect(armButton().attributes('disabled')).toBeDefined();

    await writeStoredSession(KEY, 'per-day', `${DIRECTORY}::${localDateKey(new Date())}`, {
      sessionID: 'ses_live',
      title: 'Live review',
      generation: 0,
    });
    await triggerEvent(browser.storage.local.onChanged, { [STORAGE_KEYS.sessions]: { newValue: {} } });

    await vi.waitFor(() => expect(wrapper!.text()).toContain('Live review'));
    expect(armButton().attributes('disabled')).toBeUndefined();
  });
});
