import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acceptConsent } from '@/lib/consent/consent';
import type { PickerFeedback } from '@/lib/picker/facts';
import {
  registerPickerMessageHandler,
  respondToPickerRequest,
  setElementScreenshotter,
} from '@/lib/picker/handler';
import { renderPrompt } from '@/lib/send/prompt';
import { getPendingFeedback } from '@/lib/storage/pending';
import { readOutbox } from '@/lib/storage/outbox';
import { resetSendDispatcher, setSendDispatcher } from '@/lib/send/trigger';
import { registerComposerHandler, respondToComposerRequest } from './messages';

function picked(): PickerFeedback {
  return {
    id: 'fb_pick',
    capturedAt: '2026-10-10T09:05:00.000Z',
    page: { url: 'https://example.com/cart', path: '/cart', query: [], title: 'Cart' },
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

async function pick(index = 0): Promise<void> {
  await expect(
    respondToPickerRequest({ type: 'picker/captured', feedback: picked(), elementIndex: index }, { tabId: 1 }),
  ).resolves.toEqual({ ok: true });
}

async function queue(comment: string, elementCount: number) {
  return respondToComposerRequest(
    {
      type: 'composer/queue',
      comment,
      page: { url: 'https://example.com/cart', title: 'Cart' },
      captureID: 'fb_pick',
      elementCount,
    },
    { tabId: 1 },
  );
}

describe('one picked element end to end', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await acceptConsent();
    registerPickerMessageHandler();
    registerComposerHandler();
    setElementScreenshotter({ captureFor: vi.fn(async () => null) });
    setSendDispatcher(() => {});
  });

  afterEach(() => {
    setElementScreenshotter(null);
    resetSendDispatcher();
  });

  it('holds the pick, queues one outbox item, and renders the compact prompt', async () => {
    await pick();

    const pending = await getPendingFeedback(1);
    expect(pending?.elements).toHaveLength(1);
    expect(pending?.elements[0]?.element.selector).toBe('button#checkout');

    await expect(queue('Button is misaligned', 1)).resolves.toEqual({ ok: true, outboxCount: 1 });

    const items = await readOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]?.comment).toBe('Button is misaligned');
    expect(items[0]?.facts.elements).toHaveLength(1);
    expect(items[0]?.facts.elements?.[0]?.element.selector).toBe('button#checkout');
    expect(await getPendingFeedback(1)).toBeNull();

    expect(renderPrompt({ projectName: 'example', item: items[0]! })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Button is misaligned',
        '',
        'Element: button.btn.primary — "Checkout" · button#checkout · role=button',
        '',
        'Page: https://example.com/cart',
        '  title     Cart',
      ].join('\n'),
    );
  });

  it('rejects a queue whose count does not match the picked set', async () => {
    await pick();

    await expect(queue('Two problems', 2)).resolves.toEqual({
      ok: false,
      error: 'The element set changed — pick again',
    });

    expect(await readOutbox()).toEqual([]);
    expect((await getPendingFeedback(1))?.elements).toHaveLength(1);
  });

  it('rejects the pick when its index is not a whole number from zero', async () => {
    await expect(
      respondToPickerRequest(
        { type: 'picker/captured', feedback: picked(), elementIndex: 1.5 },
        { tabId: 1 },
      ),
    ).resolves.toEqual({ ok: false, error: 'The captured element index was invalid' });

    expect(await getPendingFeedback(1)).toBeNull();
    expect(await readOutbox()).toEqual([]);
  });

  it('keeps the page-only comment path free of elements', async () => {
    const originalQuery = browser.tabs.query;
    browser.tabs.query = vi.fn(async () => [
      { id: 4, url: 'https://example.com/cart', title: 'Cart' } as unknown as Browser.tabs.Tab,
    ]) as unknown as typeof browser.tabs.query;

    await expect(respondToComposerRequest({ type: 'outbox/page-comment', comment: 'Layout jumps' })).resolves.toEqual({
      ok: true,
      outboxCount: 1,
    });

    const item = (await readOutbox())[0];
    expect(item?.facts.elements).toBeUndefined();
    expect(item?.facts.page.url).toBe('https://example.com/cart');

    browser.tabs.query = originalQuery;
  });
});
