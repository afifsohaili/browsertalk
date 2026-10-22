// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { REMOTE_PAIRING_WARNING } from '@/lib/connection/status';
import { SETUP_COPY } from '@/lib/onboarding/copy';
import { getToken, setToken } from '@/lib/storage/auth';
import { getSettings } from '@/lib/storage/settings';
import App from './App.vue';

registerBuiltinBackends();

const SAVED = 'http://127.0.0.1:15001';
const SAVED_KEY = `opencode@${SAVED}`;
const REMOTE = 'http://100.64.0.5:4096';
const REMOTE_LINK = `${REMOTE}/auth/connect/remote123`;
const COPY_FAILED = 'Could not copy. Select the command and copy it.';
const PANEL_FALLBACK = 'Open the side panel from the Browsertalk toolbar icon.';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function respondWith(version: string): FetchLike {
  return vi.fn<FetchLike>(async (url) => {
    if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
    return jsonResponse({ version });
  });
}

function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((candidate) => candidate.text() === label);
  if (found === undefined) {
    throw new Error(`No "${label}" button; rendered: ${buttonLabels(wrapper).join(', ')}`);
  }
  return found;
}

function buttonLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('button').map((candidate) => candidate.text());
}

describe('welcome setup surface', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    fakeBrowser.reset();
    registerConnectionHandler();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    resetOpenCodeFetch();
    vi.restoreAllMocks();
  });

  function mountWelcome(): VueWrapper {
    wrapper = mount(App);
    return wrapper;
  }

  it('keeps the pair form and Check again when the saved server is unreachable', async () => {
    setOpenCodeFetch(
      vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Cannot reach opencode'));

    expect(view.text()).toContain(`Cannot reach the opencode server at ${SAVED}`);
    expect(view.find('[data-testid="pairing-input"]').exists()).toBe(true);
    expect(view.text()).toContain(SETUP_COPY.credentialLabel);
    expect(view.text()).toContain(SETUP_COPY.linkWarning);
    expect(buttonLabels(view)).toEqual(expect.arrayContaining(['Check again', 'Pair', 'Copy']));
  });

  it('keeps the form during upgrade and recovers through Check again', async () => {
    await setToken(SAVED_KEY, 'tok_old');
    let version = '3.0.0';
    setOpenCodeFetch(
      vi.fn<FetchLike>(async (url) => {
        if (String(url).includes('/auth/connect/')) return jsonResponse({ token: 'tok_new' });
        return jsonResponse({ version });
      }),
    );
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Wrong opencode version'));
    expect(view.text()).toContain(SETUP_COPY.upgrade);
    expect(view.find('[data-testid="pairing-input"]').exists()).toBe(true);

    version = '2.0.32';
    await button(view, 'Check again').trigger('click');

    await vi.waitFor(() => expect(view.text()).toContain('3. Pick a project'));
    expect(view.text()).toContain('Connected: opencode 2.0.32 at 127.0.0.1:15001');
  });

  it('names the remote origin and warning before pairing it', async () => {
    const fetchFn = respondWith('2.0.32');
    setOpenCodeFetch(fetchFn);
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Not paired'));
    const callsBefore = vi.mocked(fetchFn).mock.calls.length;
    await view.get('[data-testid="pairing-input"]').setValue(REMOTE_LINK);
    await view.get('form').trigger('submit');

    await vi.waitFor(() => expect(view.text()).toContain(REMOTE));
    expect(view.text()).toContain(REMOTE_PAIRING_WARNING);
    expect(buttonLabels(view)).toEqual(expect.arrayContaining(['Pair this server', 'Cancel']));
    expect(view.find('[data-testid="pairing-input"]').exists()).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(callsBefore);
    expect((await getSettings()).serverUrl).toBe(SAVED);
    expect(await getToken(`opencode@${REMOTE}`)).toBeNull();
  });

  it('returns to the pair form when a remote link is cancelled', async () => {
    setOpenCodeFetch(respondWith('2.0.32'));
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Not paired'));
    await view.get('[data-testid="pairing-input"]').setValue(REMOTE_LINK);
    await view.get('form').trigger('submit');
    await vi.waitFor(() => expect(buttonLabels(view)).toContain('Cancel'));

    await button(view, 'Cancel').trigger('click');

    await vi.waitFor(() => expect(view.text()).not.toContain(REMOTE));
    expect(view.find('[data-testid="pairing-input"]').exists()).toBe(true);
    expect(buttonLabels(view)).toContain('Pair');
    expect(await getToken(`opencode@${REMOTE}`)).toBeNull();
    expect((await getSettings()).serverUrl).toBe(SAVED);
  });

  it('shows the project handoff when connected', async () => {
    await setToken(SAVED_KEY, 'tok_live');
    setOpenCodeFetch(respondWith('2.0.32'));
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('3. Pick a project'));

    expect(view.text()).toContain('Connected: opencode 2.0.32 at 127.0.0.1:15001');
    expect(view.text()).toContain(SETUP_COPY.handoff);
    expect(buttonLabels(view)).toContain('Open side panel');
    expect(view.find('[data-testid="pairing-input"]').exists()).toBe(false);
    expect(view.text()).toContain(SETUP_COPY.pin);
  });

  it('shows Copied after the command is copied', async () => {
    setOpenCodeFetch(respondWith('2.0.32'));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Not paired'));
    await button(view, 'Copy').trigger('click');

    await vi.waitFor(() => expect(buttonLabels(view)).toContain('Copied'));
    expect(writeText).toHaveBeenCalledWith('opencode pair');
    expect(view.text()).not.toContain(COPY_FAILED);
  });

  it('shows a visible error when the clipboard rejects', async () => {
    setOpenCodeFetch(respondWith('2.0.32'));
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('Not paired'));
    await button(view, 'Copy').trigger('click');

    await vi.waitFor(() => expect(view.text()).toContain(COPY_FAILED));
    expect(buttonLabels(view)).toContain('Copy');
  });

  it('shows the toolbar fallback when the side panel cannot open', async () => {
    await setToken(SAVED_KEY, 'tok_live');
    setOpenCodeFetch(respondWith('2.0.32'));
    const view = mountWelcome();

    await vi.waitFor(() => expect(view.text()).toContain('3. Pick a project'));
    await fakeBrowser.windows.create({ focused: true });
    await fakeBrowser.tabs.create({ url: 'https://example.test', active: true });
    const open = vi.spyOn(browser.sidePanel, 'open').mockRejectedValue(new Error('needs a gesture'));

    await button(view, 'Open side panel').trigger('click');

    await vi.waitFor(() => expect(view.text()).toContain(PANEL_FALLBACK));
    expect(open).toHaveBeenCalledWith({ windowId: expect.any(Number) });
  });
});
