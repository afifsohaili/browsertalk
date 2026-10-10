import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type { Project } from '@/lib/agent-backend/interface';
import { OpenCodeBackend } from '@/lib/agent-backend/opencode';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { sendQueuedItem } from '@/lib/send/send';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { setToken } from '@/lib/storage/auth';
import { bindProject, getBoundProject } from '@/lib/storage/projects';
import { getStoredSession, setStoredSession } from '@/lib/storage/sessions';
import { setSettings } from '@/lib/storage/settings';
import { appendToOutbox, readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { registerPanelHandler } from './messages';
import { formatTimestamp, targetState, usePanel, type Panel } from './use-panel';

type Tab = Browser.tabs.Tab;

const originalQuery = browser.tabs.query;

const ORIGIN = 'https://example.com';
const PAGE_URL = `${ORIGIN}/cart?step=2`;
const DIRECTORY = '/home/afif/example';
const STICKY_TITLE = 'Browsertalk · example';
const KEY = 'fake@http://127.0.0.1:15001';
const OPENCODE_KEY = 'opencode@http://127.0.0.1:15001';

const DEFAULT_PROJECTS: Project[] = [
  { id: 'proj_fake', name: 'fake-project', directory: '/tmp/fake-project' },
  { id: 'proj_other', name: 'other-project', directory: '/tmp/other-project' },
];

const offlineFetch = async (): Promise<Response> => {
  throw new TypeError('fetch failed');
};

class PanelFakeBackend extends FakeAgentBackend {
  override async listProjects(): Promise<Project[]> {
    return fakeProjects;
  }
}

class NoProjectsFakeBackend extends FakeAgentBackend {
  override readonly capabilities = {
    projects: false,
    namedCreation: true,
    delivery: ['queue'] as const,
    images: true,
  };

  override async listProjects(): Promise<never> {
    throw new Error('listProjects must not be called');
  }
}

let fakeProjects = DEFAULT_PROJECTS;
let fakeBackend: FakeAgentBackend = new PanelFakeBackend();

function tab(id: number, url?: string): Tab {
  return { id, url } as unknown as Tab;
}

function stubQuery(tabs: Tab[]): void {
  browser.tabs.query = vi.fn(async () => tabs) as unknown as typeof browser.tabs.query;
}

function triggerEvent(event: unknown, ...args: unknown[]): Promise<unknown> {
  return (event as { trigger: (...a: unknown[]) => Promise<unknown> }).trigger(...args);
}

function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'ob_1',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: { url: PAGE_URL, path: '/cart', query: [{ name: 'step', value: '2' }], title: 'Cart' },
    },
    ...overrides,
  };
}

function scopePanel(): { panel: Panel; stop: () => void } {
  const scope = effectScope();
  const panel = scope.run(() => usePanel())!;
  return { panel, stop: () => scope.stop() };
}

async function loadedPanel(): Promise<{ panel: Panel; stop: () => void }> {
  const created = scopePanel();
  await vi.waitFor(() => {
    expect(created.panel.loaded.value).toBe(true);
  });
  return created;
}

describe('panel logic', () => {
  beforeAll(() => {
    registerAgentBackend('fake', () => fakeBackend);
    registerAgentBackend('opencode', (config) => new OpenCodeBackend({ ...(config ?? {}), fetchFn: offlineFetch }));
    registerBuiltinSessionStrategies();
  });

  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBackend = new PanelFakeBackend();
    fakeProjects = DEFAULT_PROJECTS;
    registerPanelHandler();
    registerConnectionHandler();
    await setSettings({ backendId: 'fake', sessionStrategy: { fake: 'sticky' } });
  });

  afterEach(() => {
    browser.tabs.query = originalQuery;
    vi.restoreAllMocks();
  });

  it('loads the bound target and the lists on start', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    await setStoredSession(KEY, 'sticky', DIRECTORY, { sessionID: 'ses_seed', title: 'My review thread', generation: 0 });
    await appendToOutbox(item());

    const { panel, stop } = await loadedPanel();

    expect(panel.target.value).toEqual({
      origin: ORIGIN,
      project: DIRECTORY,
      session: { id: 'ses_seed', title: 'My review thread' },
    });
    expect(panel.outbox.value.map((entry) => entry.id)).toEqual(['ob_1']);
    expect(panel.sent.value).toEqual([]);
    stop();
  });

  it('shows no binding honestly', async () => {
    stubQuery([tab(1, PAGE_URL)]);

    const { panel, stop } = await loadedPanel();

    expect(panel.target.value).toEqual({ origin: ORIGIN, project: null, session: null });
    expect(targetState(panel.target.value)).toBe('unbound');
    expect(panel.error.value).toBeNull();
    stop();
  });

  it('shows no page honestly', async () => {
    stubQuery([tab(1, 'chrome://newtab/')]);

    const { panel, stop } = await loadedPanel();

    expect(panel.target.value).toEqual({ origin: null, project: null, session: null });
    expect(targetState(panel.target.value)).toBe('no-page');
    stop();
  });

  it('updates the header when a project binding appears', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    const { panel, stop } = await loadedPanel();
    expect(targetState(panel.target.value)).toBe('unbound');

    await bindProject(KEY, ORIGIN, DIRECTORY);

    await vi.waitFor(() => {
      expect(panel.target.value?.project).toBe(DIRECTORY);
    });
    expect(targetState(panel.target.value)).toBe('no-session');
    stop();
  });

  it('updates the header when the session changes', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    const { panel, stop } = await loadedPanel();
    expect(targetState(panel.target.value)).toBe('no-session');

    await setStoredSession(KEY, 'sticky', DIRECTORY, { sessionID: 'ses_later', title: 'Later thread', generation: 0 });

    await vi.waitFor(() => {
      expect(panel.target.value?.session).toEqual({ id: 'ses_later', title: 'Later thread' });
    });
    expect(targetState(panel.target.value)).toBe('ready');
    stop();
  });

  it('follows the active tab', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    const { panel, stop } = await loadedPanel();
    expect(panel.target.value?.origin).toBe(ORIGIN);

    stubQuery([tab(2, 'https://other.example.org/page')]);
    await triggerEvent(browser.tabs.onActivated, { tabId: 2, windowId: 0 });

    await vi.waitFor(() => {
      expect(panel.target.value?.origin).toBe('https://other.example.org');
    });
    stop();
  });

  it('follows a tab that navigates to another origin', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    const { panel, stop } = await loadedPanel();
    expect(panel.target.value?.origin).toBe(ORIGIN);

    stubQuery([tab(1, 'https://unbound.example.org/page')]);
    await triggerEvent(browser.tabs.onUpdated, 1, { url: 'https://unbound.example.org/page' });

    await vi.waitFor(() => {
      expect(panel.target.value?.origin).toBe('https://unbound.example.org');
    });
    expect(panel.target.value?.project).toBeNull();
    stop();
  });

  it('loads the outbox with its error and discards an item', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await appendToOutbox(item({ id: 'ob_error', comment: 'first', error: 'Not paired' }));
    await appendToOutbox(item({ id: 'ob_plain', comment: 'second' }));

    const { panel, stop } = await loadedPanel();
    expect(panel.outbox.value.map((entry) => entry.id)).toEqual(['ob_error', 'ob_plain']);
    expect(panel.outbox.value[0]?.error).toBe('Not paired');

    await panel.discard('ob_error');

    expect(panel.outbox.value.map((entry) => entry.id)).toEqual(['ob_plain']);
    expect((await readOutbox()).map((entry) => entry.id)).toEqual(['ob_plain']);
    stop();
  });

  it('retries a failed item into the sent list', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    await appendToOutbox(item({ id: 'ob_retry', error: 'HTTP 500' }));

    const { panel, stop } = await loadedPanel();
    expect(panel.outbox.value).toHaveLength(1);

    await panel.retry('ob_retry');

    expect(panel.outbox.value).toEqual([]);
    expect(panel.sent.value).toHaveLength(1);
    expect(panel.sent.value[0]).toMatchObject({
      id: 'ob_retry',
      comment: 'Checkout button is broken',
      session: { title: STICKY_TITLE },
    });
    expect(panel.retrying.value).toBeNull();
    stop();
  });

  it('keeps a still-failing item in the outbox with its error', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    await setSettings({ backendId: 'opencode' });
    await bindProject(OPENCODE_KEY, ORIGIN, DIRECTORY);
    await appendToOutbox(item({ id: 'ob_retry', error: 'old failure' }));

    const { panel, stop } = await loadedPanel();
    await panel.retry('ob_retry');

    expect(panel.outbox.value[0]?.error).toBe('Not paired');
    expect(panel.sent.value).toEqual([]);
    stop();
  });

  it('rolls the header to the fresh session and continues on it', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    await setStoredSession(KEY, 'sticky', DIRECTORY, { sessionID: 'ses_old', title: 'Old thread', generation: 0 });

    const { panel, stop } = await loadedPanel();
    expect(panel.target.value?.session?.id).toBe('ses_old');

    await panel.newSession();

    expect(panel.target.value?.session).toEqual({ id: 'ses_fake_1', title: STICKY_TITLE });
    expect(panel.rollingOver.value).toBe(false);
    expect(await getStoredSession(KEY, 'sticky', DIRECTORY)).toEqual({
      sessionID: 'ses_fake_1',
      title: STICKY_TITLE,
      generation: 1,
    });
    stop();
  });

  it('reports a rollover failure without fake success', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    await bindProject(KEY, ORIGIN, DIRECTORY);
    await setSettings({ backendId: 'opencode' });
    await bindProject(OPENCODE_KEY, ORIGIN, DIRECTORY);

    const { panel, stop } = await loadedPanel();
    await panel.newSession();

    expect(panel.error.value).toBe('Not paired');
    expect(panel.target.value?.session).toBeNull();
    stop();
  });

  it('refuses a rollover without a bound project', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    const { panel, stop } = await loadedPanel();

    await panel.newSession();

    expect(panel.error.value).toBe('This site has no project binding');
    expect(panel.target.value?.session).toBeNull();
    stop();
  });

  it('reports an unavailable background instead of inventing data', async () => {
    fakeBrowser.reset();
    stubQuery([tab(1, PAGE_URL)]);

    const { panel, stop } = await loadedPanel();

    expect(panel.target.value).toBeNull();
    expect(targetState(panel.target.value)).toBe('unavailable');
    expect(panel.error.value).toBe('Background unavailable');
    expect(panel.outbox.value).toEqual([]);
    expect(panel.sent.value).toEqual([]);
    stop();
  });

  it('stops listening when the scope stops', async () => {
    stubQuery([tab(1, PAGE_URL)]);
    const { panel, stop } = await loadedPanel();
    stop();

    await appendToOutbox(item());
    stubQuery([tab(2, 'https://other.example.org/page')]);
    await triggerEvent(browser.tabs.onActivated, { tabId: 2, windowId: 0 });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(panel.outbox.value).toEqual([]);
    expect(panel.target.value?.origin).toBe(ORIGIN);
  });

  describe('project binding', () => {
    it('offers the server projects for an unbound origin', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      const { panel, stop } = await loadedPanel();
      expect(targetState(panel.target.value)).toBe('unbound');

      await panel.openProjects();

      expect(panel.projectsOpen.value).toBe(true);
      expect(panel.projectsLoading.value).toBe(false);
      expect(panel.projectsSupported.value).toBe(true);
      expect(panel.projectsError.value).toBeNull();
      expect(panel.projects.value).toEqual(DEFAULT_PROJECTS);
      stop();
    });

    it('offers a manual binding when the backend cannot list projects', async () => {
      fakeBackend = new NoProjectsFakeBackend();
      stubQuery([tab(1, PAGE_URL)]);
      const { panel, stop } = await loadedPanel();

      await panel.openProjects();

      expect(panel.projectsOpen.value).toBe(true);
      expect(panel.projectsSupported.value).toBe(false);
      expect(panel.projects.value).toEqual([]);
      expect(panel.projectsError.value).toBeNull();

      await panel.chooseProject('/tmp/manual-project');

      expect(panel.projectsOpen.value).toBe(false);
      expect(panel.target.value).toEqual({ origin: ORIGIN, project: '/tmp/manual-project', session: null });
      expect(await getBoundProject(KEY, ORIGIN)).toBe('/tmp/manual-project');
      stop();
    });

    it('binds the picked project and updates the header', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      const { panel, stop } = await loadedPanel();
      await panel.openProjects();

      await panel.chooseProject('/tmp/fake-project');

      expect(panel.projectsOpen.value).toBe(false);
      expect(panel.error.value).toBeNull();
      expect(panel.target.value).toEqual({ origin: ORIGIN, project: '/tmp/fake-project', session: null });
      expect(await getBoundProject(KEY, ORIGIN)).toBe('/tmp/fake-project');
      stop();
    });

    it('re-binds through the change affordance', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      await bindProject(KEY, ORIGIN, '/tmp/fake-project');
      const { panel, stop } = await loadedPanel();
      expect(panel.target.value?.project).toBe('/tmp/fake-project');

      await panel.openProjects();
      await panel.chooseProject('/tmp/other-project');

      expect(panel.projectsOpen.value).toBe(false);
      expect(panel.target.value?.project).toBe('/tmp/other-project');
      expect(await getBoundProject(KEY, ORIGIN)).toBe('/tmp/other-project');
      stop();
    });

    it('keeps the list open with the honest error when the server is unreachable', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      await setSettings({ backendId: 'opencode' });
      await setToken(OPENCODE_KEY, 'tok_offline');
      const { panel, stop } = await loadedPanel();

      await panel.openProjects();

      expect(panel.projectsOpen.value).toBe(true);
      expect(panel.projectsLoading.value).toBe(false);
      expect(panel.projects.value).toEqual([]);
      expect(panel.projectsError.value).toBe('Cannot reach the opencode server at http://127.0.0.1:15001');
      stop();
    });

    it('shows an honest empty list without inventing projects', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      fakeProjects = [];
      const { panel, stop } = await loadedPanel();

      await panel.openProjects();

      expect(panel.projectsOpen.value).toBe(true);
      expect(panel.projects.value).toEqual([]);
      expect(panel.projectsError.value).toBeNull();
      stop();
    });

    it('reports a failed bind without faking success', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      const { panel, stop } = await loadedPanel();
      await panel.openProjects();

      await panel.chooseProject('   ');

      expect(panel.projectsOpen.value).toBe(true);
      expect(panel.projectsError.value).toBe('Pick a project first');
      expect(panel.target.value?.project).toBeNull();
      expect(await getBoundProject(KEY, ORIGIN)).toBeNull();
      stop();
    });

    it('refuses to open the list with no active page', async () => {
      stubQuery([tab(1, 'chrome://newtab/')]);
      const { panel, stop } = await loadedPanel();

      await panel.openProjects();

      expect(panel.projectsOpen.value).toBe(false);
      expect(panel.error.value).toBe('No page to target');
      stop();
    });

    it('closes the list when the active origin changes', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      const { panel, stop } = await loadedPanel();
      await panel.openProjects();
      expect(panel.projectsOpen.value).toBe(true);

      stubQuery([tab(2, 'https://other.example.org/page')]);
      await triggerEvent(browser.tabs.onActivated, { tabId: 2, windowId: 0 });

      await vi.waitFor(() => {
        expect(panel.projectsOpen.value).toBe(false);
      });
      stop();
    });

    it('sends a queued feedback to the project chosen in the panel', async () => {
      stubQuery([tab(1, PAGE_URL)]);
      await appendToOutbox(item({ id: 'ob_bind_send' }));
      const { panel, stop } = await loadedPanel();

      await panel.openProjects();
      await panel.chooseProject('/tmp/other-project');

      await expect(sendQueuedItem('ob_bind_send')).resolves.toMatchObject({ ok: true });

      expect(fakeBackend.createInputs).toEqual([
        {
          directory: '/tmp/other-project',
          title: 'Browsertalk · other-project',
          intent: { strategyId: 'sticky', strategyKey: '/tmp/other-project', generation: 0 },
        },
      ]);
      expect(fakeBackend.sent[0]?.sessionID).toBe('ses_fake_1');
      expect(fakeBackend.sent[0]?.text).toContain('## Browser feedback — other-project');
      expect(await readOutbox()).toEqual([]);
      stop();
    });
  });
});

describe('targetState', () => {
  it('selects the honest state for every target shape', () => {
    expect(targetState(null)).toBe('unavailable');
    expect(targetState({ origin: null, project: null, session: null })).toBe('no-page');
    expect(targetState({ origin: ORIGIN, project: null, session: null })).toBe('unbound');
    expect(targetState({ origin: ORIGIN, project: DIRECTORY, session: null })).toBe('no-session');
    expect(targetState({ origin: ORIGIN, project: DIRECTORY, session: { id: 'ses_1', title: 't' } })).toBe('ready');
  });
});

describe('formatTimestamp', () => {
  it('shows the local time for today', () => {
    const now = new Date(2026, 9, 10, 12, 0);
    expect(formatTimestamp(new Date(2026, 9, 10, 9, 5).toISOString(), now)).toBe('09:05');
  });

  it('adds the date when the day differs', () => {
    const now = new Date(2026, 9, 10, 12, 0);
    expect(formatTimestamp(new Date(2026, 9, 9, 23, 59).toISOString(), now)).toBe('10-09 23:59');
  });

  it('keeps the raw value for an unreadable timestamp', () => {
    expect(formatTimestamp('not a date')).toBe('not a date');
  });
});
