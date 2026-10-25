import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import { BackendError } from '@/lib/agent-backend/interface';
import type {
  AgentBackend,
  AgentBackendId,
  BackendCapabilities,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from '@/lib/agent-backend/interface';
import { OpenCodeBackend } from '@/lib/agent-backend/opencode';
import { resetOpenCodeFetch, setOpenCodeFetch, type FetchLike } from '@/lib/agent-backend/opencode-api';
import { registerAgentBackend } from '@/lib/agent-backend/registry';
import { CONSENT_REQUIRED_ERROR, acceptConsent, declineConsent } from '@/lib/consent/consent';
import { buildElementOutboxItem } from '@/lib/composer/assemble';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { rolloverStoredSession } from '@/lib/session-strategy/persist';
import { parsePageFacts } from '@/lib/picker/collect';
import type { PickerFeedback } from '@/lib/picker/facts';
import { setToken } from '@/lib/storage/auth';
import { deliveryReadySize, jsonByteSize, MAX_OUTBOX_BYTES, MAX_SENT_BYTES } from '@/lib/storage/budgets';
import { bindProject } from '@/lib/storage/projects';
import { getStoredSession } from '@/lib/storage/sessions';
import { setSettings } from '@/lib/storage/settings';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import {
  appendToOutbox,
  appendToSent,
  OutboxReservedError,
  removeFromOutbox,
  writeStoredSession,
} from '@/lib/storage/writer';
import { readSent, SENT_LIMIT, type SentItem } from '@/lib/storage/sent';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { onOutboxChanged } from '@/lib/composer/messages';
import { LEGACY_ATTEMPT_ERROR, sendQueuedItem } from './send';

const NOW = new Date(2026, 9, 10, 12, 0);
const SENT_AT = NOW.toISOString();
const DIRECTORY = '/home/afif/example';
const BOUND_ORIGIN = 'https://example.com';
const DAY_KEY = `${DIRECTORY}::2026-10-10`;
const ENDPOINT_A = 'http://127.0.0.1:15001';
const ENDPOINT_B = 'http://127.0.0.1:4096';
const FAKE_KEY = `fake@${ENDPOINT_A}`;
const OPENCODE_KEY_A = `opencode@${ENDPOINT_A}`;
const OPENCODE_KEY_B = `opencode@${ENDPOINT_B}`;

const DAY_TITLE = 'Browsertalk · example · 2026-10-10';

const noNetworkFetch: FetchLike = async () => {
  throw new TypeError('no network in tests');
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

class NoImagesBackend extends FakeAgentBackend {
  override readonly capabilities = {
    projects: true,
    namedCreation: true,
    delivery: ['queue'] as const,
    images: false,
  };
}

class RejectingBackend implements AgentBackend {
  readonly id: AgentBackendId = 'pi';
  readonly label = 'Rejecting';
  readonly capabilities: BackendCapabilities = {
    projects: false,
    namedCreation: true,
    delivery: ['queue'],
    images: true,
  };
  readonly onboarding = null;
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

let fakeBackend: FakeAgentBackend = new FakeAgentBackend();
let openCodeTimeoutMs: number | undefined;

beforeAll(() => {
  registerAgentBackend('fake', () => fakeBackend);
  registerAgentBackend('pi', () => rejectingBackend);
  registerAgentBackend(
    'opencode',
    (config) =>
      new OpenCodeBackend({
        ...config,
        ...(openCodeTimeoutMs === undefined ? {} : { timeoutMs: openCodeTimeoutMs }),
      }),
  );
  registerBuiltinSessionStrategies();
});

beforeEach(() => {
  fakeBrowser.reset();
  fakeBackend = new FakeAgentBackend();
  openCodeTimeoutMs = undefined;
  setSettings({ backendId: 'fake' });
  bindProject(FAKE_KEY, BOUND_ORIGIN, DIRECTORY);
  setOpenCodeFetch(noNetworkFetch);
  return acceptConsent();
});

afterEach(() => {
  resetOpenCodeFetch();
  vi.restoreAllMocks();
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
      elements: [
        {
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
      ],
    },
    ...overrides,
  };
}

function withScreenshot(item: OutboxItem, dataUrl = 'data:image/png;base64,AAAA'): OutboxItem {
  const [first, ...rest] = item.facts.elements ?? [];
  if (first === undefined) return item;
  return {
    ...item,
    facts: {
      ...item.facts,
      elements: [
        { ...first, extras: { ...first.extras, screenshot: { dataUrl, width: 120, height: 32 } } },
        ...rest,
      ],
    },
  };
}

function legacyElementItem(): OutboxItem {
  const current = elementItem();
  const capture = current.facts.elements![0]!;
  return {
    ...current,
    facts: {
      page: current.facts.page,
      element: capture.element,
      ...(capture.extras === undefined ? {} : { extras: capture.extras }),
    } as OutboxItem['facts'],
  };
}

function pageOutboxItem(): OutboxItem {
  return {
    id: 'ob_page',
    comment: '',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: {
        url: 'https://example.com/cart?step=2',
        path: '/cart',
        query: [{ name: 'step', value: '2' }],
        title: 'Cart',
      },
    },
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
      session: { id: 'ses_fake_1', title: DAY_TITLE },
    });

    expect(fakeBackend.createInputs).toEqual([
      {
        directory: DIRECTORY,
        title: DAY_TITLE,
        intent: { strategyId: 'per-day', strategyKey: DAY_KEY, generation: 0 },
      },
    ]);
    expect(await getStoredSession(FAKE_KEY, 'per-day', DAY_KEY)).toEqual({
      sessionID: 'ses_fake_1',
      title: DAY_TITLE,
      generation: 0,
    });

    const sent = fakeBackend.sent[0];
    expect(sent?.sessionID).toBe('ses_fake_1');
    expect(sent?.delivery).toBe('queue');
    expect(sent?.text).toContain('## Browser feedback — example');
    expect(sent?.text).toContain('Comment: Checkout button is broken');
    expect(sent?.text).toContain('Element: button.btn — "Checkout" · button#checkout · role=button');
    expect(sent?.text).not.toContain('Sent by Browsertalk');
    expect(sent?.files).toBeUndefined();

    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toEqual([
      {
        id: item.id,
        comment: 'Checkout button is broken',
        sentAt: SENT_AT,
        session: { id: 'ses_fake_1', title: DAY_TITLE },
        page: { title: 'Cart', url: 'https://example.com/cart?step=2' },
        elementCount: 1,
      },
    ]);
    expect(events).toContain('changed');
  });

  it('sends an old queued item with facts.element as a one-element set', async () => {
    const legacy = legacyElementItem();
    await browser.storage.local.set({ outbox: [legacy] });

    await expect(sendQueuedItem(legacy.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const sent = fakeBackend.sent[0];
    expect(sent?.text).toContain('Element: button.btn — "Checkout" · button#checkout · role=button');
    expect(sent?.text).not.toContain('Elements (');
    expect(await readOutbox()).toEqual([]);
    expect((await readSent())[0]?.elementCount).toBe(1);
  });

  it('records zero elementCount for a page-only send', async () => {
    const item = pageOutboxItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const sent = fakeBackend.sent[0];
    expect(sent?.text).toContain('Comment:');
    expect(sent?.text).not.toContain('Element:');
    expect(sent?.files).toBeUndefined();
    expect((await readSent())[0]?.elementCount).toBe(0);
  });

  it('sends a comment accepted at the delivery-ready budget', async () => {
    const item = elementItem({ id: 'ob_large' });
    const one = { ...item, comment: 'x' };
    const base = deliveryReadySize([one]);
    const perChar = deliveryReadySize([{ ...item, comment: 'xx' }]) - base;
    item.comment = 'x'.repeat(1 + Math.floor((MAX_OUTBOX_BYTES - base) / perChar));
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls).toHaveLength(1);
    expect(fakeBackend.feedbackCalls[0]?.text.includes(item.comment)).toBe(true);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
  });

  it('bounds the sent summary of a lone comment larger than the sent budget', async () => {
    const item = elementItem({ id: 'ob_huge' });
    item.comment = 'x'.repeat(1_100_000);
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const history = await readSent();
    expect(history.map((entry) => entry.id)).toEqual([item.id]);
    expect(jsonByteSize(history)).toBeLessThanOrEqual(MAX_SENT_BYTES);
    expect(history[0]?.comment.length).toBeGreaterThan(0);
    expect(history[0]?.comment.length).toBeLessThan(item.comment.length);
  });

  it('bounds a backend error recorded on an item accepted at the delivery-ready budget', async () => {
    const item = elementItem({ id: 'ob_large_error' });
    const one = { ...item, comment: 'x' };
    const base = deliveryReadySize([one]);
    const perChar = deliveryReadySize([{ ...item, comment: 'xx' }]) - base;
    item.comment = 'x'.repeat(1 + Math.floor((MAX_OUTBOX_BYTES - base) / perChar));
    await appendToOutbox(item);
    vi.spyOn(fakeBackend, 'sendFeedback').mockRejectedValue(new Error('E'.repeat(20_000)));

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({
      ok: false,
      error: expect.any(String),
    });

    const stored = await readOutbox();
    expect(jsonByteSize(stored)).toBeLessThanOrEqual(MAX_OUTBOX_BYTES);
    expect(stored[0]?.error?.startsWith('E')).toBe(true);
    expect(stored[0]?.error?.endsWith('…')).toBe(true);
    expect(stored[0]?.error?.length).toBeLessThan(20_000);
    expect(stored[0]?.attempt?.admissionInput?.text).toContain(item.comment.slice(-64));
    expect(stored[0]?.reservedAt).toBeUndefined();
  });

  it('bounds the sent summary of a page title larger than the sent budget', async () => {
    const item = elementItem({ id: 'ob_title', comment: 'hello' });
    item.facts.page = parsePageFacts('https://example.com', 'T'.repeat(1_100_000));
    expect(deliveryReadySize([item])).toBeLessThan(MAX_OUTBOX_BYTES);
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const history = await readSent();
    expect(history).toHaveLength(1);
    expect(jsonByteSize(history)).toBeLessThanOrEqual(MAX_SENT_BYTES);
    expect(history[0]?.id).toBe(item.id);
    expect(history[0]?.session.id).toBe('ses_fake_1');
    expect(history[0]?.page.url).toBe('https://example.com');
    expect(history[0]?.comment).toBe('hello');
    expect(history[0]?.page.title.length).toBeLessThan(1_100_000);
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
    const item = withScreenshot(elementItem());
    await appendToOutbox(item);

    await sendQueuedItem(item.id, { now: NOW });

    expect(fakeBackend.sent[0]?.files).toEqual([
      {
        uri: 'data:image/png;base64,AAAA',
        name: 'element-1.png',
        description: 'Screenshot of element 1',
      },
    ]);
  });

  it('leaves the screenshot out when the backend cannot take images', async () => {
    fakeBackend = new NoImagesBackend();
    const item = withScreenshot(elementItem());
    await appendToOutbox(item);

    await sendQueuedItem(item.id, { now: NOW });

    expect(fakeBackend.sent[0]?.files).toBeUndefined();
    expect(fakeBackend.sent[0]?.text).toContain('Comment: Checkout button is broken');
  });

  it('sends a multi-element set through the outbox builder with ordered attachments', async () => {
    const pending: PickerFeedback = {
      id: 'fb_set',
      capturedAt: '2026-10-10T09:05:00.000Z',
      page: elementItem().facts.page,
      elements: [
        {
          element: { ...elementItem().facts.elements![0]!.element, selector: 'button#checkout', text: 'Checkout' },
          extras: {
            screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 },
            component: 'CheckoutButton',
          },
        },
        {
          element: {
            ...elementItem().facts.elements![0]!.element,
            tag: 'h1',
            id: null,
            classes: ['title'],
            selector: 'h1.title',
            text: 'Your cart',
            attributes: {},
          },
        },
        {
          element: {
            ...elementItem().facts.elements![0]!.element,
            tag: 'p',
            id: null,
            classes: [],
            selector: 'p:nth-of-type(2)',
            text: 'Total',
            attributes: {},
          },
          extras: { screenshot: { dataUrl: 'data:image/png;base64,CCCC', width: 100, height: 20 } },
        },
      ],
    };
    const item = buildElementOutboxItem(pending, 'Three things', {
      id: 'ob_set',
      now: '2026-10-10T09:10:00.000Z',
    });
    await appendToOutbox(item);

    expect((await readOutbox())[0]?.facts).toEqual({
      page: pending.page,
      elements: pending.elements,
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const sent = fakeBackend.sent[0];
    expect(sent?.text).toContain('Elements (3):');
    expect(sent?.text).toContain('1. button.btn — "Checkout" · button#checkout · role=button');
    expect(sent?.text).toContain('2. h1.title — "Your cart" · h1.title');
    expect(sent?.text).toContain('3. p — "Total" · p:nth-of-type(2)');
    expect(sent?.text).toContain('   extras    component=CheckoutButton');
    expect(sent?.files?.map((file) => file.name)).toEqual(['element-1.png', 'element-3.png']);
    expect(sent?.files?.map((file) => file.uri)).toEqual([
      'data:image/png;base64,AAAA',
      'data:image/png;base64,CCCC',
    ]);
    expect(await readOutbox()).toEqual([]);
    expect((await readSent())[0]?.elementCount).toBe(3);
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

  it('keeps a failed item in the outbox with a clear error and its captured destination', async () => {
    await setSettings({ backendId: 'pi' });
    await bindProject(`pi@${ENDPOINT_A}`, BOUND_ORIGIN, DIRECTORY);
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The server rejected the prompt',
    });

    const stored = (await readOutbox())[0];
    expect(stored).toMatchObject({
      ...item,
      destination: { backendId: 'pi', endpoint: ENDPOINT_A, directory: DIRECTORY },
      error: 'The server rejected the prompt',
      attempt: { sentAt: SENT_AT },
    });
    expect(stored?.attempt?.requestID).toEqual(expect.any(String));
    expect(await readSent()).toEqual([]);
  });

  it('captures and persists the destination on the first attempt of a legacy item', async () => {
    await setSettings({ backendId: 'pi' });
    await bindProject(`pi@${ENDPOINT_A}`, BOUND_ORIGIN, DIRECTORY);
    const item = elementItem();
    await appendToOutbox(item);

    await sendQueuedItem(item.id, { now: NOW });

    expect((await readOutbox())[0]?.destination).toEqual({
      backendId: 'pi',
      endpoint: ENDPOINT_A,
      directory: DIRECTORY,
    });
  });

  it('routes a queued item to the destination captured at queue time after a settings change', async () => {
    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    await setSettings({ backendId: 'opencode', serverUrl: ENDPOINT_B });
    await setToken(OPENCODE_KEY_A, 'tok_a');
    await setToken(OPENCODE_KEY_B, 'tok_b');
    const calls: string[] = [];
    setOpenCodeFetch(async (url) => {
      calls.push(String(url));
      return String(url).includes('/prompt')
        ? jsonResponse({ data: { id: 'msg_1' } })
        : jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(calls).toEqual([`${ENDPOINT_A}/api/session`, `${ENDPOINT_A}/api/session/ses_a/prompt`]);
    expect(await getStoredSession(OPENCODE_KEY_A, 'per-day', DAY_KEY)).toEqual({
      sessionID: 'ses_a',
      title: DAY_TITLE,
      generation: 0,
    });
    expect(await getStoredSession(OPENCODE_KEY_B, 'per-day', DAY_KEY)).toBeNull();
  });

  it('does not use another endpoint token for a captured destination', async () => {
    await setSettings({ backendId: 'opencode', serverUrl: ENDPOINT_B });
    await setToken(OPENCODE_KEY_B, 'tok_b');
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: 'Not paired' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect((await readOutbox())[0]?.error).toBe('Not paired');
  });

  it('keeps one attempt on the captured endpoint and token when settings change mid-attempt', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');

    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    const calls: Array<{ url: string; auth: unknown }> = [];
    let first = true;
    setOpenCodeFetch(async (url, init) => {
      calls.push({ url: String(url), auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      if (first) {
        first = false;
        await setSettings({ serverUrl: ENDPOINT_B });
        await setToken(OPENCODE_KEY_B, 'tok_b');
        return jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
      }
      return jsonResponse({ data: { id: 'msg_1' } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(calls.map((call) => call.url)).toEqual([
      `${ENDPOINT_A}/api/session`,
      `${ENDPOINT_A}/api/session/ses_a/prompt`,
    ]);
    expect(calls.every((call) => call.auth === `Basic ${btoa('opencode:tok_a')}`)).toBe(true);
    expect(await getStoredSession(OPENCODE_KEY_A, 'per-day', DAY_KEY)).toEqual({
      sessionID: 'ses_a',
      title: DAY_TITLE,
      generation: 0,
    });
    expect(await getStoredSession(OPENCODE_KEY_B, 'per-day', DAY_KEY)).toBeNull();
  });

  it('keeps the captured destination across a failed attempt and retry', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');

    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    setOpenCodeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: `Cannot reach the opencode server at ${ENDPOINT_A}`,
    });
    expect((await readOutbox())[0]?.destination).toEqual(item.destination);

    await setSettings({ serverUrl: ENDPOINT_B });
    await setToken(OPENCODE_KEY_B, 'tok_b');

    const calls: string[] = [];
    setOpenCodeFetch(async (url) => {
      calls.push(String(url));
      return String(url).includes('/prompt')
        ? jsonResponse({ data: { id: 'msg_1' } })
        : jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([`${ENDPOINT_A}/api/session`, `${ENDPOINT_A}/api/session/ses_a/prompt`]);
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

    const stored = (await readOutbox())[0];
    expect(stored?.error).toBe('This site has no project binding');
    expect(stored?.destination).toBeUndefined();
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
    await bindProject(OPENCODE_KEY_A, BOUND_ORIGIN, DIRECTORY);
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: 'Not paired' });

    expect((await readOutbox())[0]?.error).toBe('Not paired');
    expect(await readSent()).toEqual([]);
  });

  it('fails clearly when the stored server URL left loopback, without touching the network', async () => {
    await browser.storage.local.set({ 'settings.serverUrl': 'https://example.com' });
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"',
    });

    const stored = (await readOutbox())[0];
    expect(stored?.error).toBe('The server must be on this machine — use localhost, 127.0.0.1, or ::1, or turn on "Allow a remote server"');
    expect(stored?.destination).toBeUndefined();
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

const AMBIGUOUS_ERROR =
  'The server did not confirm the feedback was admitted; retrying is safe and will not send it twice';

class LostResponseBackend extends FakeAgentBackend {
  private lost = false;

  override async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const result = await super.sendFeedback(input);
    if (!this.lost) {
      this.lost = true;
      throw new BackendError('ambiguous-admission', 'response lost');
    }
    return result;
  }
}

class FailsOnceBackend extends FakeAgentBackend {
  private failed = false;

  override async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    if (!this.failed) {
      this.failed = true;
      throw new Error('The fake server hiccuped');
    }
    return super.sendFeedback(input);
  }
}

interface JsonBody {
  id?: string;
  text?: string;
}

describe('admission reliability', () => {
  it('reuses the same request id and text when a definite failure retries', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');
    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    const bodies: JsonBody[] = [];
    setOpenCodeFetch(async (url, init) => {
      if (String(url).endsWith('/prompt')) {
        bodies.push(JSON.parse(String(init?.body)) as JsonBody);
        return bodies.length === 1 ? jsonResponse({ _tag: 'InternalError' }, 500) : jsonResponse({ data: { id: 'msg_1' } });
      }
      return jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The opencode server returned HTTP 500',
    });
    const failed = (await readOutbox())[0];
    expect(failed?.error).toBe('The opencode server returned HTTP 500');
    expect(failed?.attempt?.requestID).toEqual(expect.any(String));
    expect(failed?.attempt?.sentAt).toBe(SENT_AT);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.id).toBe(`msg_${failed?.attempt?.requestID}`);
    expect(bodies[1]?.id).toBe(bodies[0]?.id);
    expect(bodies[1]?.text).toBe(bodies[0]?.text);
    expect(await readOutbox()).toEqual([]);
    expect((await readSent())[0]?.sentAt).toBe(SENT_AT);
  });

  it('does not duplicate feedback admitted before the response was lost', async () => {
    fakeBackend = new LostResponseBackend();
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: AMBIGUOUS_ERROR });
    const failed = (await readOutbox())[0];
    expect(failed?.admission).toBeUndefined();
    expect(failed?.attempt?.requestID).toEqual(expect.any(String));
    expect(fakeBackend.feedbackCalls).toHaveLength(1);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls.map((call) => call.requestID)).toEqual([
      failed?.attempt?.requestID,
      failed?.attempt?.requestID,
    ]);
    expect(fakeBackend.sent).toHaveLength(1);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
  });

  it('retries a lost receipt onto the original session after a rollover, and logs it against that session', async () => {
    fakeBackend = new LostResponseBackend();
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: AMBIGUOUS_ERROR });

    const failed = (await readOutbox())[0];
    expect(failed?.attempt?.admissionInput).toEqual({
      sessionID: 'ses_fake_1',
      sessionTitle: DAY_TITLE,
      text: expect.stringContaining('Checkout button is broken'),
      delivery: 'queue',
    });

    await rolloverStoredSession({
      backend: fakeBackend,
      connectionKey: FAKE_KEY,
      strategyId: 'per-day',
      strategyKey: DAY_KEY,
      directory: DIRECTORY,
      title: DAY_TITLE,
    });
    const rolled = await getStoredSession(FAKE_KEY, 'per-day', DAY_KEY);
    expect(rolled?.generation).toBe(1);
    expect(rolled?.sessionID).not.toBe('ses_fake_1');

    const createsBeforeRetry = fakeBackend.createInputs.length;
    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.createInputs).toHaveLength(createsBeforeRetry);
    expect(fakeBackend.feedbackCalls.map((call) => call.sessionID)).toEqual(['ses_fake_1', 'ses_fake_1']);
    expect((await readSent())[0]).toMatchObject({
      id: item.id,
      session: { id: 'ses_fake_1', title: DAY_TITLE },
    });
    expect(await readOutbox()).toEqual([]);
  });

  it('reuses the frozen session, text, and attachments when a retry meets changed backend capabilities', async () => {
    fakeBackend = new FailsOnceBackend();
    const item = withScreenshot(elementItem());
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The fake server hiccuped',
    });

    const frozen = (await readOutbox())[0]?.attempt?.admissionInput;
    expect(frozen?.delivery).toBe('queue');
    expect(frozen?.files).toEqual([
      {
        uri: 'data:image/png;base64,AAAA',
        name: 'element-1.png',
        description: 'Screenshot of element 1',
      },
    ]);

    fakeBackend = new NoImagesBackend();
    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const retry = fakeBackend.feedbackCalls[0];
    expect(retry?.sessionID).toBe(frozen?.sessionID);
    expect(retry?.text).toBe(frozen?.text);
    expect(retry?.files).toEqual(frozen?.files);
    expect((await readSent())[0]?.session).toEqual({ id: frozen?.sessionID, title: DAY_TITLE });
  });

  it('transmits nothing and logs nothing when the item is discarded while the session resolves', async () => {
    const gated = new GatedCreateBackend();
    fakeBackend = gated;
    const item = elementItem();
    await appendToOutbox(item);

    const send = sendQueuedItem(item.id, { now: NOW });
    await vi.waitFor(() => {
      expect(gated.startedCreates).toHaveLength(1);
    });

    await removeFromOutbox(item.id);
    gated.release();

    await expect(send).resolves.toEqual({ ok: false, error: 'The item is no longer in the outbox' });
    expect(gated.feedbackCalls).toEqual([]);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toEqual([]);
  });

  it('keeps a 2xx admission without a receipt retryable', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');
    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    const bodies: JsonBody[] = [];
    setOpenCodeFetch(async (url, init) => {
      if (String(url).endsWith('/prompt')) {
        bodies.push(JSON.parse(String(init?.body)) as JsonBody);
        return bodies.length === 1 ? jsonResponse({ data: {} }) : jsonResponse({ data: { id: 'msg_1' } });
      }
      return jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: AMBIGUOUS_ERROR });
    const failed = (await readOutbox())[0];
    expect(failed?.error).toBe(AMBIGUOUS_ERROR);
    expect(failed?.attempt?.requestID).toEqual(expect.any(String));

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });
    expect(bodies[1]?.id).toBe(`msg_${failed?.attempt?.requestID}`);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
  });

  it('marks a deadline expiry ambiguous and keeps the request id for the retry', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');
    openCodeTimeoutMs = 25;
    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    await appendToOutbox(item);

    setOpenCodeFetch((url, init) => {
      if (String(url).endsWith('/prompt')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      return Promise.resolve(jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } }));
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: AMBIGUOUS_ERROR });
    const failed = (await readOutbox())[0];
    expect(failed?.error).toBe(AMBIGUOUS_ERROR);
    expect(failed?.attempt?.requestID).toEqual(expect.any(String));

    const captured: { body: JsonBody | null } = { body: null };
    setOpenCodeFetch(async (url, init) => {
      if (String(url).endsWith('/prompt')) {
        captured.body = JSON.parse(String(init?.body)) as JsonBody;
        return jsonResponse({ data: { id: 'msg_1' } });
      }
      return jsonResponse({ data: { id: 'ses_a', title: DAY_TITLE } });
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });
    expect(captured.body?.id).toBe(`msg_${failed?.attempt?.requestID}`);
    expect(await readOutbox()).toEqual([]);
  });

  it('resumes an admitted receipt after a worker restart without calling the backend', async () => {
    const item = elementItem({
      attempt: { requestID: 'req_seed', sentAt: '2026-10-10T08:00:00.000Z' },
      admission: {
        requestID: 'req_seed',
        messageID: 'msg_seed',
        sessionID: 'ses_seed',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        admittedAt: '2026-10-10T08:00:01.000Z',
      },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls).toEqual([]);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toEqual([
      {
        id: item.id,
        comment: 'Checkout button is broken',
        sentAt: '2026-10-10T08:00:00.000Z',
        session: { id: 'ses_seed', title: 'Browsertalk · example · 2026-10-10' },
        page: { title: 'Cart', url: 'https://example.com/cart?step=2' },
        elementCount: 1,
      },
    ]);
  });

  it('recovers an admitted opencode receipt without calling the backend', async () => {
    await setSettings({ backendId: 'opencode' });
    const fetchFn = vi.fn<FetchLike>(noNetworkFetch);
    setOpenCodeFetch(fetchFn);
    const item = elementItem({
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
      attempt: { requestID: 'req_seed', sentAt: '2026-10-10T08:00:00.000Z' },
      admission: {
        requestID: 'req_seed',
        messageID: 'msg_seed',
        sessionID: 'ses_seed',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        admittedAt: '2026-10-10T08:00:01.000Z',
      },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: true,
      session: { id: 'ses_seed', title: 'Browsertalk · example · 2026-10-10' },
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(await readOutbox()).toEqual([]);
    expect((await readSent())[0]?.session.id).toBe('ses_seed');
  });

  it('commits an admission receipt without a message id', async () => {
    const item = elementItem({
      attempt: { requestID: 'req_seed', sentAt: '2026-10-10T08:00:00.000Z' },
      admission: {
        requestID: 'req_seed',
        messageID: null,
        sessionID: 'ses_seed',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        admittedAt: '2026-10-10T08:00:01.000Z',
      },
    });
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls).toEqual([]);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
    expect((await readSent())[0]?.session.id).toBe('ses_seed');
  });

  it('commits the outbox removal and the sent append in one storage write', async () => {
    const item = elementItem();
    await appendToOutbox(item);
    const setSpy = vi.spyOn(browser.storage.local, 'set');

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    const commits = setSpy.mock.calls.filter(([keys]) => {
      const record = keys as Record<string, unknown>;
      return 'outbox' in record && 'sent' in record;
    });
    expect(commits).toHaveLength(1);
    setSpy.mockRestore();
  });

  it('keeps the admission receipt when the cleanup write rejects, and resumes without resending', async () => {
    const item = elementItem();
    await appendToOutbox(item);

    const originalSet = browser.storage.local.set.bind(browser.storage.local);
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockImplementation(async (keys) => {
      const record = keys as Record<string, unknown>;
      if ('outbox' in record && 'sent' in record) throw new Error('quota exceeded');
      return originalSet(keys);
    });

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: 'quota exceeded' });

    const failed = (await readOutbox())[0];
    expect(failed?.admission).toMatchObject({ requestID: expect.any(String), messageID: expect.any(String) });
    expect(failed?.error).toBe('quota exceeded');
    expect(fakeBackend.feedbackCalls).toHaveLength(1);

    setSpy.mockRestore();

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls).toHaveLength(1);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
  });
});

describe('admission reservation', () => {
  it('transmits nothing and logs nothing when the discard lands before the reservation', async () => {
    const item = elementItem();
    await appendToOutbox(item);

    type ReadStored = (keys?: unknown) => Promise<Record<string, unknown>>;
    const originalGet = browser.storage.local.get as unknown as ReadStored;
    let reads = 0;
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const getSpy = vi.spyOn(browser.storage.local, 'get').mockImplementation((async (keys?: unknown) => {
      const result = await originalGet(keys);
      if (keys === STORAGE_KEYS.consent.status && ++reads === 2) {
        started();
        await gate;
      }
      return result;
    }) as unknown as typeof browser.storage.local.get);

    const sending = sendQueuedItem(item.id, { now: NOW });
    await entered;
    await removeFromOutbox(item.id);
    expect(await readOutbox()).toEqual([]);
    expect(fakeBackend.feedbackCalls).toHaveLength(0);
    release();

    await expect(sending).resolves.toEqual({ ok: false, error: 'The item is no longer in the outbox' });
    expect(fakeBackend.feedbackCalls).toHaveLength(0);
    expect(await readSent()).toEqual([]);
    getSpy.mockRestore();
  });

  it('refuses a discard after the reservation and still logs the sent summary', async () => {
    const gated = new GatedSendBackend();
    fakeBackend = gated;
    const item = elementItem();
    await appendToOutbox(item);

    const sending = sendQueuedItem(item.id, { now: NOW });
    await vi.waitFor(() => {
      expect(gated.started).toHaveLength(1);
    });

    await expect(removeFromOutbox(item.id)).rejects.toBeInstanceOf(OutboxReservedError);
    const reserved = (await readOutbox())[0];
    expect(reserved?.reservedAt).toBe(SENT_AT);

    gated.release();
    await expect(sending).resolves.toEqual({ ok: true, session: { id: 'ses_fake_1', title: DAY_TITLE } });
    expect(gated.feedbackCalls).toHaveLength(1);
    expect(await readOutbox()).toEqual([]);
    expect(await readSent()).toHaveLength(1);
  });
});

describe('legacy attempts', () => {
  it('blocks an ambiguous legacy retry instead of reusing its request id against a new session', async () => {
    await fakeBackend.sendFeedback({
      requestID: 'legacy-request',
      sessionID: 'original-session',
      text: 'original-text',
      delivery: 'queue',
    });
    await writeStoredSession(FAKE_KEY, 'per-day', DAY_KEY, { sessionID: 'ses_new', title: DAY_TITLE, generation: 1 });
    const item = elementItem({
      attempt: { requestID: 'legacy-request', sentAt: '2026-10-10T08:00:00.000Z' },
    });
    await appendToOutbox(item);

    const outcome = await sendQueuedItem(item.id, { now: NOW });

    expect(outcome).toEqual({ ok: false, error: LEGACY_ATTEMPT_ERROR });
    expect(fakeBackend.feedbackCalls.map((call) => call.requestID)).toEqual(['legacy-request']);
    expect(fakeBackend.sent.map((call) => call.sessionID)).toEqual(['original-session']);
    const stored = (await readOutbox())[0];
    expect(stored?.attempt).toEqual({ requestID: 'legacy-request', sentAt: '2026-10-10T08:00:00.000Z' });
    expect(stored?.admission).toBeUndefined();
    expect(stored?.error).toBe(LEGACY_ATTEMPT_ERROR);
    expect(await readSent()).toEqual([]);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({ ok: false, error: LEGACY_ATTEMPT_ERROR });
    expect(fakeBackend.feedbackCalls).toHaveLength(1);
    expect(await readSent()).toEqual([]);
  });

  it('recovers a blocked legacy attempt only by discard and re-queue', async () => {
    const legacy = elementItem({
      attempt: { requestID: 'legacy-request', sentAt: '2026-10-10T08:00:00.000Z' },
    });
    await appendToOutbox(legacy);
    await sendQueuedItem(legacy.id, { now: NOW });

    await removeFromOutbox(legacy.id);
    expect(await readOutbox()).toEqual([]);

    const fresh = elementItem({ id: 'ob_2', comment: 'Fixed' });
    await appendToOutbox(fresh);
    await expect(sendQueuedItem(fresh.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls[0]?.requestID).not.toBe('legacy-request');
    expect((await readSent())[0]?.session.id).toBe('ses_fake_1');
  });

  it('keeps a definite-failure retry on the frozen session after a rollover and logs that session', async () => {
    fakeBackend = new FailsOnceBackend();
    const item = elementItem();
    await appendToOutbox(item);

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The fake server hiccuped',
    });
    const frozen = (await readOutbox())[0]?.attempt?.admissionInput;
    expect(frozen).toMatchObject({ sessionID: 'ses_fake_1', sessionTitle: DAY_TITLE, delivery: 'queue' });

    await rolloverStoredSession({
      backend: fakeBackend,
      connectionKey: FAKE_KEY,
      strategyId: 'per-day',
      strategyKey: DAY_KEY,
      directory: DIRECTORY,
      title: DAY_TITLE,
    });
    const rolled = await getStoredSession(FAKE_KEY, 'per-day', DAY_KEY);
    expect(rolled?.sessionID).not.toBe(frozen?.sessionID);
    const createsBeforeRetry = fakeBackend.createInputs.length;

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls.map((call) => call.sessionID)).toEqual([frozen?.sessionID]);
    expect(fakeBackend.createInputs).toHaveLength(createsBeforeRetry);
    expect((await readSent())[0]?.session).toEqual({ id: frozen?.sessionID, title: DAY_TITLE });
    expect(await readOutbox()).toEqual([]);
  });
});

describe('error recording', () => {
  it('surfaces a failure to record the send error without losing the outcome', async () => {
    await setSettings({ backendId: 'pi' });
    await bindProject(`pi@${ENDPOINT_A}`, BOUND_ORIGIN, DIRECTORY);
    const item = elementItem();
    await appendToOutbox(item);

    const originalSet = browser.storage.local.set.bind(browser.storage.local);
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockImplementation(async (keys) => {
      const record = keys as Record<string, unknown>;
      const items = record.outbox;
      if (Array.isArray(items) && items.some((entry) => (entry as OutboxItem).error !== undefined)) {
        throw new Error('QUOTA_BYTES quota exceeded');
      }
      return originalSet(keys);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: 'The server rejected the prompt',
    });

    expect(errorSpy).toHaveBeenCalled();
    expect((await readOutbox())[0]?.error).toBeUndefined();

    setSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

class GatedSendBackend extends FakeAgentBackend {
  readonly started: FeedbackSendInput[] = [];
  private releases: Array<() => void> = [];

  override async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    this.started.push(input);
    await new Promise<void>((resolve) => this.releases.push(resolve));
    return super.sendFeedback(input);
  }

  release(): void {
    this.releases.shift()?.();
  }
}

class GatedCreateBackend extends FakeAgentBackend {
  readonly startedCreates: SessionCreateInput[] = [];
  private releases: Array<() => void> = [];

  override async createSession(input: SessionCreateInput): Promise<SessionRef> {
    this.startedCreates.push(input);
    await new Promise<void>((resolve) => this.releases.push(resolve));
    return super.createSession(input);
  }

  release(): void {
    this.releases.shift()?.();
  }
}

describe('consent at delivery time', () => {
  it('keeps a queued item with a consent error when consent is not accepted', async () => {
    const item = elementItem();
    await appendToOutbox(item);
    await declineConsent();

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toEqual({
      ok: false,
      error: CONSENT_REQUIRED_ERROR,
    });

    const stored = (await readOutbox())[0];
    expect(stored?.error).toBe(CONSENT_REQUIRED_ERROR);
    expect(fakeBackend.sent).toEqual([]);
    expect(fakeBackend.feedbackCalls).toEqual([]);
    expect(fakeBackend.createInputs).toEqual([]);
  });

  it('commits an already-admitted item even when consent is revoked', async () => {
    const item = elementItem({
      attempt: { requestID: 'req_seed', sentAt: '2026-10-10T08:00:00.000Z' },
      admission: {
        requestID: 'req_seed',
        messageID: 'msg_seed',
        sessionID: 'ses_seed',
        sessionTitle: 'Browsertalk · example · 2026-10-10',
        admittedAt: '2026-10-10T08:00:01.000Z',
      },
    });
    await appendToOutbox(item);
    await declineConsent();

    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(await readOutbox()).toEqual([]);
    expect(fakeBackend.feedbackCalls).toEqual([]);
  });

  it('blocks a send whose turn comes after consent is revoked mid-queue', async () => {
    const gated = new GatedSendBackend();
    fakeBackend = gated;
    const first = elementItem({ id: 'ob_1' });
    const second = elementItem({ id: 'ob_2', comment: 'Second thought' });
    await appendToOutbox(first);
    await appendToOutbox(second);

    const firstSend = sendQueuedItem(first.id, { now: NOW });
    await vi.waitFor(() => {
      expect(gated.started).toHaveLength(1);
    });

    const secondSend = sendQueuedItem(second.id, { now: NOW });
    await declineConsent();
    gated.release();

    await expect(firstSend).resolves.toMatchObject({ ok: true });
    await expect(secondSend).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });

    expect(gated.started).toHaveLength(1);
    const stored = (await readOutbox()).find((item) => item.id === 'ob_2');
    expect(stored?.error).toBe(CONSENT_REQUIRED_ERROR);
    expect(stored?.admission).toBeUndefined();
    expect(await readSent()).toHaveLength(1);
  });

  it('blocks admission when consent is revoked while the session resolves', async () => {
    const gated = new GatedCreateBackend();
    fakeBackend = gated;
    const item = elementItem();
    await appendToOutbox(item);

    const send = sendQueuedItem(item.id, { now: NOW });
    await vi.waitFor(() => {
      expect(gated.startedCreates).toHaveLength(1);
    });

    await declineConsent();
    gated.release();

    await expect(send).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });
    expect(gated.feedbackCalls).toEqual([]);
    expect((await readOutbox())[0]?.error).toBe(CONSENT_REQUIRED_ERROR);
  });

  it('sends again after consent is accepted before the retry', async () => {
    const item = elementItem();
    await appendToOutbox(item);
    await declineConsent();
    await sendQueuedItem(item.id, { now: NOW });
    expect(fakeBackend.feedbackCalls).toEqual([]);

    await acceptConsent();
    await expect(sendQueuedItem(item.id, { now: NOW })).resolves.toMatchObject({ ok: true });

    expect(fakeBackend.feedbackCalls).toHaveLength(1);
    expect(await readOutbox()).toEqual([]);
  });
});

describe('connection queues', () => {
  it('does not let a stalled connection block another connection', async () => {
    await setSettings({ backendId: 'opencode' });
    await setToken(OPENCODE_KEY_A, 'tok_a');
    await setToken(OPENCODE_KEY_B, 'tok_b');
    openCodeTimeoutMs = 1000;

    const stalled = elementItem({
      id: 'ob_stalled',
      destination: { backendId: 'opencode', endpoint: ENDPOINT_A, directory: DIRECTORY },
    });
    const other = elementItem({
      id: 'ob_other',
      destination: { backendId: 'opencode', endpoint: ENDPOINT_B, directory: DIRECTORY },
    });
    await appendToOutbox(stalled);
    await appendToOutbox(other);

    setOpenCodeFetch((url, init) => {
      const endpoint = new URL(String(url)).origin;
      if (String(url).endsWith('/prompt')) {
        if (endpoint === ENDPOINT_B) return Promise.resolve(jsonResponse({ data: { id: 'msg_b' } }));
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      return Promise.resolve(
        jsonResponse({ data: { id: endpoint === ENDPOINT_A ? 'ses_a' : 'ses_b', title: DAY_TITLE } }),
      );
    });

    let stalledSettled = false;
    const stalledOutcome = sendQueuedItem(stalled.id, { now: NOW }).then((outcome) => {
      stalledSettled = true;
      return outcome;
    });

    const otherOutcome = await sendQueuedItem(other.id, { now: NOW });

    expect(otherOutcome).toMatchObject({ ok: true });
    expect(stalledSettled).toBe(false);

    await expect(stalledOutcome).resolves.toEqual({ ok: false, error: AMBIGUOUS_ERROR });
    const sent = await readSent();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.id).toBe(other.id);
  });
});
