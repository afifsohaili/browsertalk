import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getPendingFeedback } from '@/lib/storage/pending';
import type { PickerFeedback } from './facts';
import {
  armPickerOnActiveTab,
  armPickerOnTab,
  notifyCaptured,
  registerPickerMessageHandler,
  requestArmPicker,
} from './messages';

type Tab = Browser.tabs.Tab;

const originalQuery = browser.tabs.query;
const originalSendMessage = browser.tabs.sendMessage;

function tab(id: number): Tab {
  return { id } as unknown as Tab;
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

function sampleFeedback(): PickerFeedback {
  return {
    id: 'fb_1',
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
      attributes: { role: 'button', 'data-testid': 'checkout' },
      box: { x: 10, y: 20, width: 120, height: 32 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

describe('picker messaging', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerPickerMessageHandler();
  });

  afterEach(() => {
    browser.tabs.query = originalQuery;
    browser.tabs.sendMessage = originalSendMessage;
  });

  it('arms the active tab through its content script', async () => {
    stubQuery([tab(7)]);
    const send = stubSendMessage({ ok: true, armed: true });

    await expect(armPickerOnActiveTab()).resolves.toEqual({ ok: true, armed: true });
    expect(send).toHaveBeenCalledWith(7, { type: 'picker/arm' });
  });

  it('reports no active page clearly', async () => {
    stubQuery([]);

    await expect(armPickerOnActiveTab()).resolves.toEqual({
      ok: false,
      error: 'No active page to arm the picker on',
    });
  });

  it('reports a page without a content script clearly', async () => {
    stubSendMessage(new Error('Receiving end does not exist'));

    await expect(armPickerOnTab(7)).resolves.toEqual({
      ok: false,
      error: "Can't arm the picker on this page",
    });
  });

  it('passes through a disarm toggle from the content script', async () => {
    stubSendMessage({ ok: true, armed: false });

    await expect(armPickerOnTab(7)).resolves.toEqual({ ok: true, armed: false });
  });

  it('arms from a surface through the background', async () => {
    stubQuery([tab(7)]);
    stubSendMessage({ ok: true, armed: true });

    await expect(requestArmPicker()).resolves.toEqual({ ok: true, armed: true });
  });

  it('falls back honestly when the background is not there', async () => {
    fakeBrowser.reset();

    await expect(requestArmPicker()).resolves.toEqual({ ok: false, error: 'Background unavailable' });
  });

  it('holds captured feedback as the pending feedback', async () => {
    const item = sampleFeedback();

    await expect(notifyCaptured(item)).resolves.toEqual({ ok: true });
    expect(await getPendingFeedback()).toEqual(item);
  });

  it('rejects malformed captured feedback', async () => {
    const response = await browser.runtime.sendMessage({
      type: 'picker/captured',
      feedback: { nope: true },
    });

    expect(response).toEqual({ ok: false, error: 'The captured feedback was invalid' });
    expect(await getPendingFeedback()).toBeNull();
  });

  it('leaves messages for other modules alone', async () => {
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse('other module');
      return true;
    });

    await expect(browser.runtime.sendMessage({ type: 'connection/status' })).resolves.toBe('other module');
  });
});
