import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONSENT_REQUIRED_ERROR, acceptConsent } from '@/lib/consent/consent';
import type { PickerFeedback } from '@/lib/picker/facts';
import { resetSendDispatcher, setSendDispatcher } from '@/lib/send/trigger';
import { deliveryReadySize, MAX_OUTBOX_BYTES } from '@/lib/storage/budgets';
import { bindProject } from '@/lib/storage/projects';
import { getPendingFeedback, setPendingFeedback } from '@/lib/storage/pending';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { appendToOutbox } from '@/lib/storage/writer';
import type { ComposerQueueRequest, ComposerRequest } from './protocol';
import {
  broadcastOutboxChanged,
  onOutboxChanged,
  registerComposerHandler,
  requestOutboxCount,
  requestPageComment,
  requestQueueComment,
  requestRemoveElement,
  respondToComposerRequest,
} from './messages';

type Tab = Browser.tabs.Tab;

const originalQuery = browser.tabs.query;

let requestedSends: string[] = [];

function tab(id: number, url?: string, title?: string): Tab {
  return { id, url, title } as unknown as Tab;
}

function stubQuery(tabs: Tab[]): void {
  browser.tabs.query = vi.fn(async () => tabs) as unknown as typeof browser.tabs.query;
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
    elements: [
      {
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
      },
    ],
  };
}

function secondElement(): PickerFeedback['elements'][number] {
  return {
    element: {
      tag: 'h1',
      id: null,
      classes: ['title'],
      selector: 'h1.title',
      text: 'Your cart',
      attributes: {},
      box: { x: 10, y: 200, width: 320, height: 40 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

function elementQueue(captureID: string, comment: string, elementCount = 1): ComposerQueueRequest {
  return {
    type: 'composer/queue',
    comment,
    page: { url: 'https://example.com/cart', title: 'Cart' },
    captureID,
    elementCount,
  };
}

function pageComment(comment: string): ComposerRequest {
  return { type: 'outbox/page-comment', comment };
}

function removeElement(index: number, captureID = 'fb_1'): ComposerRequest {
  return { type: 'composer/remove', captureID, index };
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
  const one = { ...seed, comment: 'x' };
  const base = deliveryReadySize([one]);
  const perChar = deliveryReadySize([{ ...seed, comment: 'xx' }]) - base;
  seed.comment = 'x'.repeat(1 + Math.floor((MAX_OUTBOX_BYTES - headroom - base) / perChar));
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
    expect(items[0]?.facts.elements).toEqual(pending.elements);
    expect(requestedSends).toEqual([items[0]?.id]);
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('queues an ordered element set from one pending feedback', async () => {
    const pending: PickerFeedback = {
      ...sampleFeedback(),
      elements: [
        {
          ...sampleFeedback().elements[0]!,
          extras: { screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 } },
        },
        secondElement(),
      ],
    };
    await setPendingFeedback(1, pending);

    await expect(respondToComposerRequest(elementQueue('fb_1', 'Two problems', 2), { tabId: 1 })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const item = (await readOutbox())[0];
    expect(item?.facts.elements?.map((entry) => entry.element.selector)).toEqual(['button#checkout', 'h1.title']);
    expect(item?.facts.elements?.[0]?.extras?.screenshot).toEqual(pending.elements[0]?.extras?.screenshot);
    expect(item?.facts.elements?.[1]?.extras).toBeUndefined();
  });

  it('refuses a set whose count does not match the pending elements', async () => {
    const pending: PickerFeedback = {
      ...sampleFeedback(),
      elements: [sampleFeedback().elements[0]!, secondElement()],
    };
    await setPendingFeedback(1, pending);

    for (const elementCount of [1, 3]) {
      await expect(
        respondToComposerRequest(elementQueue('fb_1', 'Two problems', elementCount), { tabId: 1 }),
      ).resolves.toEqual({ ok: false, error: 'The element set changed — pick again' });
    }

    expect(await readOutbox()).toEqual([]);
    expect(requestedSends).toEqual([]);
    expect((await getPendingFeedback(1))?.elements).toHaveLength(2);
  });

  it('removes one chip element from the pending set and reports the count', async () => {
    await setPendingFeedback(1, {
      ...sampleFeedback(),
      elements: [sampleFeedback().elements[0]!, secondElement()],
    });

    await expect(respondToComposerRequest(removeElement(0), { tabId: 1 })).resolves.toEqual({
      ok: true,
      elementCount: 1,
    });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['h1.title']);

    await expect(respondToComposerRequest(elementQueue('fb_1', 'Only the heading', 1), { tabId: 1 })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const item = (await readOutbox())[0];
    expect(item?.facts.elements?.map((entry) => entry.element.selector)).toEqual(['h1.title']);
  });

  it('refuses a removal for a set the tab no longer holds', async () => {
    await setPendingFeedback(1, sampleFeedback('fb_other'));

    await expect(respondToComposerRequest(removeElement(0), { tabId: 1 })).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });
    expect((await getPendingFeedback(1))?.elements).toHaveLength(1);
  });

  it('refuses a removal without a sender tab', async () => {
    await setPendingFeedback(1, sampleFeedback());

    await expect(respondToComposerRequest(removeElement(0))).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });
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
      elements: [
        {
          ...sampleFeedback().elements[0]!,
          extras: {
            component: 'CheckoutButton',
            screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 },
          },
        },
      ],
    };
    await setPendingFeedback(1, pending);

    await respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 });

    expect((await readOutbox())[0]?.facts.elements?.[0]?.extras).toEqual(pending.elements[0]?.extras);
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
    expect(items.map((item) => item.facts.elements?.[0]?.element.text)).toEqual(['Checkout', 'Checkout']);
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

  it('queues a page comment from the active tab and clears that tab stale pick', async () => {
    stubQuery([tab(4, 'https://example.com/cart?step=2#pay', 'Cart')]);
    await setPendingFeedback(4, sampleFeedback('fb_active_tab'));
    await setPendingFeedback(2, sampleFeedback('fb_other_tab'));

    await expect(respondToComposerRequest(pageComment('Layout jumps'))).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const item = (await readOutbox())[0];
    expect(item?.comment).toBe('Layout jumps');
    expect(item?.facts.elements).toBeUndefined();
    expect(item?.facts.page).toEqual({
      url: 'https://example.com/cart?step=2#pay',
      path: '/cart',
      query: [{ name: 'step', value: '2' }],
      title: 'Cart',
    });
    expect(requestedSends).toEqual([item?.id]);
    expect(await getPendingFeedback(4)).toBeNull();
    expect((await getPendingFeedback(2))?.id).toBe('fb_other_tab');
  });

  it('queues page comments through the registered handler, with and without a comment', async () => {
    stubQuery([tab(4, 'https://example.com/cart', 'Cart')]);

    await expect(requestPageComment('Layout jumps')).resolves.toEqual({ ok: true, outboxCount: 1 });
    await expect(requestPageComment('')).resolves.toEqual({ ok: true, outboxCount: 2 });

    expect((await readOutbox()).map((item) => item.comment)).toEqual(['Layout jumps', '']);
  });

  it('queues the active page URL with an empty comment', async () => {
    stubQuery([tab(4, 'https://example.com/page?q=1', 'Page')]);

    await expect(respondToComposerRequest(pageComment(''))).resolves.toEqual({ ok: true, outboxCount: 1 });

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

  it('reports a page comment clearly when there is no active page', async () => {
    stubQuery([]);

    await expect(respondToComposerRequest(pageComment('Layout jumps'))).resolves.toEqual({
      ok: false,
      error: 'No active page to comment on',
    });
    expect(await readOutbox()).toEqual([]);
  });

  it('reports a page comment clearly when the tab URL is not readable', async () => {
    stubQuery([tab(4)]);

    await expect(respondToComposerRequest(pageComment(''))).resolves.toEqual({
      ok: false,
      error: "Can't read this page's URL",
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

    await expect(requestOutboxCount()).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestPageComment('Fix this')).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(
      requestQueueComment('Fix this', { url: 'https://example.com/', title: 'Example' }, 'fb_1', 1),
    ).resolves.toEqual({ ok: false, error: 'Background unavailable' });
    await expect(requestRemoveElement('fb_1', 0)).resolves.toEqual({
      ok: false,
      error: 'Background unavailable',
    });
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
      await appendToOutbox(fillOutbox(10_000));
      const pending: PickerFeedback = {
        ...sampleFeedback(),
        elements: [
          {
            ...sampleFeedback().elements[0]!,
            extras: {
              component: 'CheckoutButton',
              screenshot: {
                dataUrl: `data:image/png;base64,${'A'.repeat(100_000)}`,
                width: 120,
                height: 32,
              },
            },
          },
        ],
      };
      await setPendingFeedback(1, pending);

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this'), { tabId: 1 })).resolves.toEqual({
        ok: true,
        outboxCount: 2,
        screenshotDropped: true,
      });

      const stored = (await readOutbox()).find((item) => item.id !== 'ob_seed');
      expect(stored?.facts.elements?.[0]?.extras).toEqual({ component: 'CheckoutButton' });
      expect(await getPendingFeedback(1)).toBeNull();
      expect(requestedSends).toEqual([stored?.id]);
    });

    it('drops the last element screenshot when an earlier element has none', async () => {
      await appendToOutbox(fillOutbox(10_000));
      const pending: PickerFeedback = {
        ...sampleFeedback(),
        elements: [
          secondElement(),
          {
            ...sampleFeedback().elements[0]!,
            extras: {
              screenshot: {
                dataUrl: `data:image/png;base64,${'A'.repeat(100_000)}`,
                width: 120,
                height: 32,
              },
            },
          },
        ],
      };
      await setPendingFeedback(1, pending);

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Fix this', 2), { tabId: 1 })).resolves.toEqual({
        ok: true,
        outboxCount: 2,
        screenshotDropped: true,
      });

      const stored = (await readOutbox()).find((item) => item.id !== 'ob_seed');
      expect(stored?.facts.elements?.[1]?.extras).toBeUndefined();
      expect(stored?.facts.elements?.[0]?.element.selector).toBe('h1.title');
    });

    it('drops screenshots from the last element until the outbox takes the item', async () => {
      await appendToOutbox(fillOutbox(250_000));
      const shots: PickerFeedback['elements'] = ['a', 'b', 'c'].map((fill, index) => ({
        element: {
          ...sampleFeedback().elements[0]!.element,
          tag: 'p',
          id: null,
          classes: [],
          selector: `p.shot-${index + 1}`,
          text: `Shot ${index + 1}`,
        },
        extras: {
          screenshot: {
            dataUrl: `data:image/png;base64,${fill.repeat(100_000)}`,
            width: 120,
            height: 32,
          },
        },
      }));
      await setPendingFeedback(1, { ...sampleFeedback(), elements: shots });

      await expect(respondToComposerRequest(elementQueue('fb_1', 'Three shots', 3), { tabId: 1 })).resolves.toEqual({
        ok: true,
        outboxCount: 2,
        screenshotDropped: true,
      });

      const stored = (await readOutbox()).find((item) => item.id !== 'ob_seed');
      expect(stored?.facts.elements?.map((entry) => entry.element.selector)).toEqual([
        'p.shot-1',
        'p.shot-2',
        'p.shot-3',
      ]);
      expect(stored?.facts.elements?.map((entry) => entry.extras?.screenshot?.dataUrl)).toEqual([
        `data:image/png;base64,${'a'.repeat(100_000)}`,
        undefined,
        undefined,
      ]);
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
      stubQuery([tab(4, 'https://example.com/page?q=1', 'Page')]);

      await expect(respondToComposerRequest(pageComment('Layout jumps'))).resolves.toEqual({
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

    it('refuses to queue a URL-only send from the same path', async () => {
      stubQuery([tab(4, 'https://example.com/page?q=1', 'Page')]);

      await expect(respondToComposerRequest(pageComment(''))).resolves.toEqual({
        ok: false,
        error: CONSENT_REQUIRED_ERROR,
      });

      expect(await readOutbox()).toEqual([]);
      expect(requestedSends).toEqual([]);
    });
  });
});
