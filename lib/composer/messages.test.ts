import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONSENT_REQUIRED_ERROR, acceptConsent } from '@/lib/consent/consent';
import type { PickerFeedback } from '@/lib/picker/facts';
import { resetSendDispatcher, setSendDispatcher } from '@/lib/send/trigger';
import { MAX_OUTBOX_BYTES, outboxSize } from '@/lib/storage/budgets';
import { bindProject } from '@/lib/storage/projects';
import { getPendingFeedback, setPendingFeedback } from '@/lib/storage/pending';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { appendToOutbox } from '@/lib/storage/writer';
import type { ComposerQueueRequest } from './protocol';
import {
  broadcastOutboxChanged,
  onOutboxChanged,
  openComposerOnActiveTab,
  openComposerOnTab,
  registerComposerHandler,
  requestOpenComposer,
  requestOutboxCount,
  requestQueueComment,
  requestQueueUrlOnly,
  respondToComposerRequest,
} from './messages';

type Tab = Browser.tabs.Tab;

const originalQuery = browser.tabs.query;
const originalSendMessage = browser.tabs.sendMessage;

let requestedSends: string[] = [];

function tab(id: number, url?: string, title?: string): Tab {
  return { id, url, title } as unknown as Tab;
}

function stubQuery(tabs: Tab[]): void {
  browser.tabs.query = vi.fn(async () => tabs) as unknown as typeof browser.tabs.query;
}

function stubSendMessage(result: unknown): ReturnType<typeof vi.fn> {
  const implementation =
    result instanceof Error
      ? async () => {
          throw result;
        }
      : async () => result;
  const mock = vi.fn(implementation);
  browser.tabs.sendMessage = mock as unknown as typeof browser.tabs.sendMessage;
  return mock;
}

function sampleFeedback(id = 'fb_1'): PickerFeedback {
  return {
    id,
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: {
      url: 'https://example.com/cart?step=2',
      path: '/cart',
      query: [{ name: 'step', value: '2' }],
      title: 'Cart',
    },
    element: {
      tag: 'button',
      id: 'checkout',
      classes: ['btn', 'primary'],
      selector: 'button#checkout',
      text: 'Checkout',
      attributes: { role: 'button' },
      box: { x: 10, y: 20, width: 120, height: 32 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

function elementQueue(captureID: string, comment: string): ComposerQueueRequest {
  return {
    type: 'composer/queue',
    mode: 'element',
    comment,
    page: { url: 'https://example.com/cart', title: 'Cart' },
    captureID,
  };
}

function pageQueue(comment: string): ComposerQueueRequest {
  return {
    type: 'composer/queue',
    mode: 'page',
    comment,
    page: { url: 'https://example.com/cart?step=2#pay', title: ' Cart ' },
  };
}

function storedItem(): OutboxItem {
  return {
    id: 'ob_seed',
    comment: 'seed',
    capturedAt: '2026-10-10T08:00:00.000Z',
    status: 'queued',
    facts: {
      page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' },
    },
  };
}

function fillOutbox(headroom: number): OutboxItem {
  const seed = storedItem();
  const overhead = outboxSize([{ ...seed, comment: '' }]);
  seed.comment = 'x'.repeat(MAX_OUTBOX_BYTES - overhead - headroom);
  return seed;
}

describe('composer messaging', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await acceptConsent();
    registerComposerHandler();
    requestedSends = [];
    setSendDispatcher((itemId) => requestedSends.push(itemId));
  });

  afterEach(() => {
    browser.tabs.query = originalQuery;
    browser.tabs.sendMessage = originalSendMessage;
    resetSendDispatcher();
  });

  it('queues the comment with the picked feedback and clears the pending feedback', async () => {
    const pending = sampleFeedback();
    await setPendingFeedback(1, pending);

    await expect(respondToComposerRequest(elementQueue('fb_1', 'Button is misaligned'), { tabId: 1 })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const items = await readOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      comment: 'Button is misaligned',
      capturedAt: pending.capturedAt,
      status: 'queued',
    });
    expect(items[0]?.facts.page).toEqual(pending.page);
    expect(items[0]?.facts.element).toEqual(pending.element);
    expect(requestedSends).toEqual([items[0]?.id]);
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('captures the destination connection and binding when queued', async () => {
    await bindProject('opencode@http://127.0.0.1:15001', 'https://example.com', '/home/afif/example');
    await setPendingFeedback(1, sampleFeedback());

    await respondToComposerRequest(elementQueue('fb_1', 'Button is misaligned'), { tabId: 1 });

    expect((await readOutbox())[0]?.destination).toEqual({
      backendId: 'opencode',
      endpoint: 'http://127.0.0.1:15001',
      directory: '/home/afif/example',
    });
  });

  it('leaves the destination empty for an unbound origin, honestly', async () => {
    await setPendingFeedback(1, sampleFeedback());

    await respondToComposerRequest(elementQueue('fb_1', 'Button is misaligned'), { tabId: 1 });

    expect((await readOutbox())[0]?.destination).toBeUndefined();
  });

  it('keeps the extras that the background attached to the pick', async () => {
    const pending: PickerFeedback = {
      ...sampleFeedback(),
      extras: {
        component: 'CheckoutButton',
        screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 },
      },
    };
    await setPendingFeedback(1, pending);

    await respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 });

    expect((await readOutbox())[0]?.facts.extras).toEqual(pending.extras);
  });

  it('refuses an element comment without a picked element', async () => {
    await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 })).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });

    expect(await readOutbox()).toEqual([]);
    expect(requestedSends).toEqual([]);
  });

  it('refuses a submission whose capture the tab no longer holds', async () => {
    await setPendingFeedback(1, sampleFeedback('fb_old'));

    await expect(respondToComposerRequest(elementQueue('fb_missing', 'Fix this'), { tabId: 1 })).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });

    expect(await readOutbox()).toEqual([]);
    expect((await getPendingFeedback(1))?.id).toBe('fb_old');
  });

  it('keeps two tabs picks apart and consumes only the submitted one', async () => {
    const first = sampleFeedback('fb_first');
    const second = {
      ...sampleFeedback('fb_second'),
      page: { url: 'https://other.example.org/', path: '/', query: [], title: 'Other' },
    };
    await setPendingFeedback(1, first);
    await setPendingFeedback(2, second);

    await respondToComposerRequest(elementQueue('fb_first', 'First tab'), { tabId: 1 });

    expect(await getPendingFeedback(1)).toBeNull();
    expect((await getPendingFeedback(2))?.id).toBe('fb_second');

    await respondToComposerRequest(elementQueue('fb_second', 'Second tab'), { tabId: 2 });

    const items = await readOutbox();
    expect(items.map((item) => item.comment)).toEqual(['First tab', 'Second tab']);
    expect(items.map((item) => item.facts.page.url)).toEqual(['https://example.com/cart?step=2', 'https://other.example.org/']);
    expect(items.map((item) => item.facts.element?.text)).toEqual(['Checkout', 'Checkout']);
    expect(await getPendingFeedback(2)).toBeNull();
  });

  it('refuses an element comment when the sender tab is unknown', async () => {
    await setPendingFeedback(1, sampleFeedback());

    await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this'))).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });

    expect(await readOutbox()).toEqual([]);
    expect((await getPendingFeedback(1))?.id).toBe('fb_1');
  });

  it('queues a page comment with just the page facts and clears that tab stale pick', async () => {
    await setPendingFeedback(1, sampleFeedback());
    await setPendingFeedback(2, sampleFeedback('fb_other_tab'));

    await expect(respondToComposerRequest(pageQueue('Layout jumps'), { tabId: 1 })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const item = (await readOutbox())[0];
    expect(item?.comment).toBe('Layout jumps');
    expect(item?.facts.element).toBeUndefined();
    expect(item?.facts.page).toEqual({
      url: 'https://example.com/cart?step=2#pay',
      path: '/cart',
      query: [{ name: 'step', value: '2' }],
      title: 'Cart',
    });
    expect(requestedSends).toEqual([item?.id]);
    expect(await getPendingFeedback(1)).toBeNull();
    expect((await getPendingFeedback(2))?.id).toBe('fb_other_tab');
  });

  it('queues a page comment from a surface without a sender tab', async () => {
    await expect(requestQueueComment('Layout jumps', 'page', { url: 'https://example.com/cart', title: 'Cart' })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });
  });

  it('queues the active page URL with an empty comment', async () => {
    stubQuery([tab(4, 'https://example.com/page?q=1', 'Page')]);

    await expect(requestQueueUrlOnly()).resolves.toEqual({ ok: true, outboxCount: 1 });

    const item = (await readOutbox())[0];
    expect(item?.comment).toBe('');
    expect(item?.facts).toEqual({
      page: {
        url: 'https://example.com/page?q=1',
        path: '/page',
        query: [{ name: 'q', value: '1' }],
        title: 'Page',
      },
    });
    expect(requestedSends).toEqual([item?.id]);
  });

  it('reports URL-only clearly when there is no active page', async () => {
    stubQuery([]);

    await expect(requestQueueUrlOnly()).resolves.toEqual({
      ok: false,
      error: 'No active page to comment on',
    });
    expect(await readOutbox()).toEqual([]);
  });

  it('reports URL-only clearly when the tab URL is not readable', async () => {
    stubQuery([tab(4)]);

    await expect(requestQueueUrlOnly()).resolves.toEqual({
      ok: false,
      error: "Can't read this page's URL",
    });
  });

  it('opens the composer through the active tab content script', async () => {
    stubQuery([tab(7)]);
    const send = stubSendMessage({ ok: true });

    await expect(requestOpenComposer()).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith(7, { type: 'composer/open' });
  });

  it('reports a page without a content script clearly', async () => {
    stubSendMessage(new Error('Receiving end does not exist'));

    await expect(openComposerOnTab(7)).resolves.toEqual({
      ok: false,
      error: "Can't comment on this page",
    });
  });

  it('reports no active page clearly when opening the composer', async () => {
    stubQuery([]);

    await expect(openComposerOnActiveTab()).resolves.toEqual({
      ok: false,
      error: 'No active page to comment on',
    });
  });

  it('counts the queued items', async () => {
    await appendToOutbox(storedItem());

    await expect(requestOutboxCount()).resolves.toEqual({ ok: true, count: 1 });
  });

  it('broadcasts outbox changes to open surfaces', async () => {
    const events: string[] = [];
    const stop = onOutboxChanged(() => events.push('changed'));

    broadcastOutboxChanged();

    expect(events).toEqual(['changed']);
    stop();
  });

  it('falls back honestly when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestOpenComposer()).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestOutboxCount()).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(
      requestQueueComment('Fix this', 'page', { url: 'https://example.com/', title: 'Example' }),
    ).resolves.toEqual({ ok: false, error: 'Background unavailable' });
  });

  it('leaves messages for other modules alone', async () => {
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse('other module');
      return true;
    });

    await expect(browser.runtime.sendMessage({ type: 'picker/arm' })).resolves.toBe('other module');
  });

  describe('when storage cannot take the screenshot', () => {
    it('queues the feedback without the screenshot on a full outbox', async () => {
      await appendToOutbox(fillOutbox(2_000));
      const pending: PickerFeedback = {
        ...sampleFeedback(),
        extras: {
          component: 'CheckoutButton',
          screenshot: {
            dataUrl: `data:image/png;base64,${'A'.repeat(100_000)}`,
            width: 120,
            height: 32,
          },
        },
      };
      await setPendingFeedback(1, pending);

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 })).resolves.toEqual({
        ok: true,
        outboxCount: 2,
        screenshotDropped: true,
      });

      const stored = (await readOutbox()).find((item) => item.id !== 'ob_seed');
      expect(stored?.facts.extras).toEqual({ component: 'CheckoutButton' });
      expect(await getPendingFeedback(1)).toBeNull();
      expect(requestedSends).toEqual([stored?.id]);
    });

    it('keeps the pick and reports the error when there is no screenshot to drop', async () => {
      await appendToOutbox(fillOutbox(100));
      await setPendingFeedback(1, sampleFeedback());

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 })).resolves.toEqual({
        ok: false,
        error: 'The outbox is at its size limit — discard some queued feedback and try again',
      });

      expect((await readOutbox()).map((item) => item.id)).toEqual(['ob_seed']);
      expect((await getPendingFeedback(1))?.id).toBe('fb_1');
      expect(requestedSends).toEqual([]);
    });
  });

  describe('before the feedback disclosure is accepted', () => {
    beforeEach(() => {
      fakeBrowser.reset();
      registerComposerHandler();
      requestedSends = [];
      setSendDispatcher((itemId) => requestedSends.push(itemId));
    });

    it('refuses to queue a page comment', async () => {
      await expect(respondToComposerRequest(pageQueue('Layout jumps'), { tabId: 1 })).resolves.toEqual({
        ok: false,
        error: CONSENT_REQUIRED_ERROR,
      });

      expect(await readOutbox()).toEqual([]);
      expect(requestedSends).toEqual([]);
    });

    it('refuses to queue an element comment even with a pending pick', async () => {
      await setPendingFeedback(1, sampleFeedback());

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Button is misaligned'), { tabId: 1 })).resolves.toEqual({
        ok: false,
        error: CONSENT_REQUIRED_ERROR,
      });

      expect(await readOutbox()).toEqual([]);
      expect(requestedSends).toEqual([]);
    });

    it('refuses to queue the active page URL only', async () => {
      stubQuery([tab(4, 'https://example.com/page?q=1', 'Page')]);

      await expect(requestQueueUrlOnly()).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });

      expect(await readOutbox()).toEqual([]);
      expect(requestedSends).toEqual([]);
    });
  });
});
