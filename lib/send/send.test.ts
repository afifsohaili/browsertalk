import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type {
  AgentBackend,
  AgentBackendId,
  BackendStatus,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from '@/lib/agent-backend/interface';
import { OpenCodeBackend } from '@/lib/agent-backend/opencode';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { bindProject } from '@/lib/storage/projects';
import { getStoredSession } from '@/lib/storage/sessions';
import { setSettings } from '@/lib/storage/settings';
import { appendToOutbox, readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { appendToSent, readSent, SENT_LIMIT, type SentItem } from '@/lib/storage/sent';
import { onOutboxChanged } from '@/lib/composer/messages';
import { sendQueuedItem } from './send';

const NOW = new Date(2026, 9, 10, 12, 0);
const SENT_AT = NOW.toISOString();
const DIRECTORY = '/home/afif/example';
const BOUND_ORIGIN = 'https://example.com';

class RejectingBackend implements AgentBackend {
  readonly id: AgentBackendId = 'pi';
  readonly label = 'Rejecting';
  readonly capabilities = { projects: true };
  readonly defaultSessionStrategy = 'per-day';

  async ping(): Promise<BackendStatus> {
    return { ok: true, detail: 'rejecting backend' };
  }

  async listProjects(): Promise<Project[]> {
    return [];
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    return { id: 'ses_pi_1', title: input.title };
  }

  async sendFeedback(): Promise<SendResult> {
    throw new Error('The server rejected the prompt');
  }
}

const rejectingBackend = new RejectingBackend();

let fakeBackend = new FakeAgentBackend();

beforeAll(() => {
  registerAgentBackend('fake', () => fakeBackend);
  registerAgentBackend('pi', () => rejectingBackend);
  registerAgentBackend(
    'opencode',
    () => new OpenCodeBackend({ fetchFn: async () => Promise.reject(new Error('no network in tests')) }),
  );
  registerBuiltinSessionStrategies();
});

function elementItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'ob_1',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: {
        url: 'https://example.com/cart?step=2',
        path: '/cart',
        query: [{ name: 'step', value: '2' }],
        title: 'Cart',
      },
      element: {
        tag: 'button',
        id: 'checkout',
        classes: ['btn'],
        selector: 'button#checkout',
        text: 'Checkout',
        attributes: { role: 'button' },
        box: { x: 10, y: 20, width: 120, height: 32 },
        viewport: { width: 1280, height: 800 },
        scroll: { x: 0, y: 0 },
      },
    },
    ...overrides,
  };
}

function seededSent(n: number): SentItem {
  return {
    id: `seeded_${n}`,
    comment: `seeded ${n}`,
    sentAt: '2026-10-10T08:00:00.000Z',
    session: { id: 'ses_seed', title: 'Browsertalk · example · 2026-10-09' },
    page: { title: 'Cart', url: 'https://example.com/cart' },
  };
}

describe('send pipeline', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBackend = new FakeAgentBackend();
    setSettings({ backendId: 'fake' });
    bindProject(BOUND_ORIGIN, DIRECTORY);
  });

  it('creates the day session through the seam and sends with queue delivery', async () => {
    const item = elementItem();
    await appendToOutbox(item);
    const events: string[] = [];
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message === 'object' && message !== null && (message as { type?: string }).type === 'outbox/changed') {
        events.push('changed');
      }
      return undefined;
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: true,
      session: { id: 'ses_fake_1', title: 'Browsertalk · example · 2026-10-10' },
    });

    expect(fakeBackend.createInputs).toEqual([
      { directory: DIRECTORY, title: 'Browsertalk · example · 2026-10-10' },
    ]);
    expect(await getStoredSession('fake', 'per-day', `${DIRECTORY}::2026-10-10`)).toEqual({
      sessionID: 'ses_fake_1',
      title: 'Browsertalk · example · 2026-10-10',
    });

    const sent = fakeBackend.sent[0];
    expect(sent?.sessionID).toBe('ses_fake_1');
    expect(sent?.delivery).toBe('queue');
    expect(sent?.text).toContain('## Browser feedback — example');
    expect(sent?.text).toContain('Comment: Checkout button is broken');
    expect(sent?.text).toContain(`Sent by Browsertalk · ${SENT_AT}`);
    expect(sent?.files).toBeUndefined();

    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toEqual([
      {
        id: item.id,
        comment: 'Checkout button is broken',
        sentAt: SENT_AT,
        session: { id: 'ses_fake_1', title: 'Browsertalk · example · 2026-10-10' },
        page: { title: 'Cart', url: 'https://example.com/cart?step=2' },
      },
    ]);
    expect(events).toContain('changed');
  });

  it('reuses the day session for a later feedback and keeps the queue order', async () => {
    const first = elementItem({ id: 'ob_1' });
    const second = elementItem({ id: 'ob_2', comment: 'Second thought' });
    await appendToOutbox(first);
    await appendToOutbox(second);

    const outcomes = await Promise.all([
      sendQueuedItem(first.id, { now: NOW }),
      sendQueuedItem(second.id, { now: NOW }),
    ]);

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(fakeBackend.sessions).toHaveLength(1);
    expect(fakeBackend.sent.map((input) => input.sessionID)).toEqual(['ses_fake_1', 'ses_fake_1']);
    expect(fakeBackend.sent.map((input) => input.text.includes('Second thought'))).toEqual([false, true]);
    expect((await readSent()).map((item) => item.comment)).toEqual(['Second thought', 'Checkout button is broken']);
  });

  it('attaches the screenshot as a file when the pick has one', async () => {
    const item = elementItem({
      facts: {
        ...elementItem().facts,
        extras: { screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 } },
      },
    });
    await appendToOutbox(item);

    await sendQueuedItem(item.id, { now: NOW });

    expect(fakeBackend.sent[0]?.files).toEqual([
      {
        uri: 'data:image/png;base64,AAAA',
        name: 'element.png',
        description: 'Screenshot of the picked element',
      },
    ]);
  });

  it('keeps the sent log capped when a send succeeds', async () => {
    for (let n = 1; n <= SENT_LIMIT; n += 1) await appendToSent(seededSent(n));
    const item = elementItem();
    await appendToOutbox(item);

    await sendQueuedItem(item.id, { now: NOW });

    const items = await readSent();
    expect(items).toHaveLength(SENT_LIMIT);
    expect(items[0]?.id).toBe(item.id);
    expect(items.at(-1)?.id).toBe('seeded_2');
  });

  it('keeps a failed item in the outbox with a clear error', async () => {
    await setSettings({ backendId: 'pi' });
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The server rejected the prompt',
    });

    expect(await readOutbox()).toEqual([{ ...item, error: 'The server rejected the prompt' }]);
    expect(await readSent()).toEqual([]);
  });

  it('fails clearly when the site has no project binding', async () => {
    const item = elementItem({
      id: 'ob_unbound',
      facts: {
        ...elementItem().facts,
        page: { url: 'https://unbound.example.org/page', path: '/page', query: [], title: 'Page' },
      },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'This site has no project binding',
    });

    expect((await readOutbox())[0]?.error).toBe('This site has no project binding');
    expect(fakeBackend.sent).toEqual([]);
    expect(fakeBackend.createInputs).toEqual([]);
  });

  it('fails clearly when the feedback has an unreadable URL', async () => {
    const item = elementItem({
      id: 'ob_bad_url',
      facts: {
        ...elementItem().facts,
        page: { url: 'not a url', path: '', query: [], title: '' },
      },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The page URL in this feedback is unreadable',
    });

    expect((await readOutbox())[0]?.error).toBe('The page URL in this feedback is unreadable');
  });

  it('fails clearly when the opencode backend is not paired, without touching the network', async () => {
    await setSettings({ backendId: 'opencode' });
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: 'Not paired' });

    expect((await readOutbox())[0]?.error).toBe('Not paired');
    expect(await readSent()).toEqual([]);
  });

  it('no-ops for an item that is no longer in the outbox', async () => {
    await expect(sendQueuedItem('ob_missing', { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The item is no longer in the outbox',
    });

    expect(await readSent()).toEqual([]);
    expect(fakeBackend.sent).toEqual([]);
  });
});
