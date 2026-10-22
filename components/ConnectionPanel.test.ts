// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import ConnectionPanel from '@/components/ConnectionPanel.vue';
import { registerBuiltinBackends } from '@/lib/agent-backend/builtins';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { setToken } from '@/lib/storage/auth';
import { setSettings } from '@/lib/storage/settings';

registerBuiltinBackends();

const SAVED = 'http://127.0.0.1:15001';
const SAVED_KEY = `opencode@${SAVED}`;
const WELCOME_URL = 'chrome-extension://test-extension-id/welcome.html';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function respondWith(version: string): FetchLike {
  return vi.fn<FetchLike>(async () => jsonResponse({ version }));
}

function unreachable(): FetchLike {
  return vi.fn<FetchLike>(async () => {
    throw new TypeError('fetch failed');
  });
}

interface CardCase {
  name: string;
  prepare: () => Promise<void>;
  label: string;
  action: string | null;
  stateClass: string;
}

const CASES: CardCase[] = [
  {
    name: 'unreachable',
    prepare: async () => {
      setOpenCodeFetch(unreachable());
    },
    label: 'Cannot reach opencode',
    action: 'Start opencode, then test again',
    stateClass: 'unreachable',
  },
  {
    name: 'unpaired',
    prepare: async () => {
      setOpenCodeFetch(respondWith('2.0.32'));
    },
    label: 'Not paired',
    action: 'Pair with opencode',
    stateClass: 'unpaired',
  },
  {
    name: 'unauthorized',
    prepare: async () => {
      await setToken(SAVED_KEY, 'tok_stale');
      setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));
    },
    label: 'Pairing token rejected',
    action: 'Pair again with a fresh link',
    stateClass: 'unauthorized',
  },
  {
    name: 'incompatible',
    prepare: async () => {
      await setToken(SAVED_KEY, 'tok_old');
      setOpenCodeFetch(respondWith('3.0.0'));
    },
    label: 'Wrong opencode version',
    action: 'Run opencode upgrade',
    stateClass: 'incompatible',
  },
  {
    name: 'connected',
    prepare: async () => {
      await setToken(SAVED_KEY, 'tok_live');
      setOpenCodeFetch(respondWith('2.0.32'));
    },
    label: 'Connected',
    action: null,
    stateClass: 'connected',
  },
];

function setupButton(wrapper: VueWrapper) {
  return wrapper.find('button.setup');
}

function expectNoPairingForm(wrapper: VueWrapper): void {
  expect(wrapper.find('[data-testid="pairing-input"]').exists()).toBe(false);
  expect(wrapper.find('form').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('2. Pair');
}

describe('connection panel setup card', () => {
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

  function mountCard(): VueWrapper {
    wrapper = mount(ConnectionPanel);
    return wrapper;
  }

  it.each(CASES)('shows the $name label and next action', async ({ prepare, label, action, stateClass }) => {
    await prepare();
    const view = mountCard();

    await vi.waitFor(() => expect(view.text()).toContain(label));

    expect(view.find('[data-connection-state]').classes()).toContain(stateClass);
    if (action === null) {
      expect(view.find('.next').exists()).toBe(false);
      expect(setupButton(view).exists()).toBe(false);
      expect(view.text()).toContain('Connected: opencode 2.0.32 at 127.0.0.1:15001');
    } else {
      expect(view.get('.next').text()).toBe(action);
      expect(setupButton(view).exists()).toBe(true);
    }
    expectNoPairingForm(view);
  });

  it('reports Connected for the fake backend without reading the network', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);
    await setSettings({ backendId: 'fake' });
    const view = mountCard();

    await vi.waitFor(() => expect(view.text()).toContain('Connected'));

    expect(setupButton(view).exists()).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
    expectNoPairingForm(view);
  });

  it('opens the welcome tab from Finish setup', async () => {
    setOpenCodeFetch(respondWith('2.0.32'));
    const view = mountCard();

    await vi.waitFor(() => expect(setupButton(view).exists()).toBe(true));
    await setupButton(view).trigger('click');

    await vi.waitFor(async () => {
      const urls = (await fakeBrowser.tabs.query({})).map((tab) => tab.url ?? '');
      expect(urls).toContain(WELCOME_URL);
    });
  });
});
