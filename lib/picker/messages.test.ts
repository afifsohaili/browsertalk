import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONSENT_REQUIRED_ERROR, acceptConsent, declineConsent } from '@/lib/consent/consent';
import { getPendingFeedback } from '@/lib/storage/pending';
import type { PickerFeedback } from './facts';
import {
  armPickerOnActiveTab,
  armPickerOnTab,
  notifyCaptured,
  registerPickerMessageHandler,
  requestArmPicker,
  respondToPickerRequest,
  setElementScreenshotter,
} from './messages';
import type { ElementScreenshotter } from './screenshot';

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

function triggerEvent(event: unknown, ...args: unknown[]): Promise<unknown> {
  return (event as { trigger: (...a: unknown[]) => Promise<unknown> }).trigger(...args);
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

function captured(feedback: PickerFeedback, tabId: number, windowId?: number): ReturnType<typeof respondToPickerRequest> {
  return respondToPickerRequest(
    { type: 'picker/captured', feedback },
    windowId === undefined ? { tabId } : { tabId, windowId },
  );
}

describe('picker messaging', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await acceptConsent();
    registerPickerMessageHandler();
    stubQuery([tab(1)]);
    setElementScreenshotter({ captureFor: vi.fn(async () => null) });
  });

  afterEach(() => {
    browser.tabs.query = originalQuery;
    browser.tabs.sendMessage = originalSendMessage;
    setElementScreenshotter(null);
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

  it('holds captured feedback as the pending feedback for the sender tab', async () => {
    const item = sampleFeedback();

    await expect(captured(item, 1)).resolves.toEqual({ ok: true });
    expect(await getPendingFeedback(1)).toEqual(item);
    expect(await getPendingFeedback(2)).toBeNull();
  });

  it('holds each tab capture separately', async () => {
    const first = sampleFeedback();
    const second: PickerFeedback = {
      ...sampleFeedback(),
      id: 'fb_2',
      page: { url: 'https://other.example.org/', path: '/', query: [], title: 'Other' },
    };

    await captured(first, 1);
    await captured(second, 2);

    expect((await getPendingFeedback(1))?.id).toBe('fb_1');
    expect((await getPendingFeedback(2))?.id).toBe('fb_2');
  });

  it('rejects a capture that does not name the sender tab', async () => {
    await expect(respondToPickerRequest({ type: 'picker/captured', feedback: sampleFeedback() })).resolves.toEqual({
      ok: false,
      error: 'No page sent this capture',
    });
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('rejects malformed captured feedback', async () => {
    const response = await browser.runtime.sendMessage({
      type: 'picker/captured',
      feedback: { nope: true },
    });

    expect(response).toEqual({ ok: false, error: 'The captured feedback was invalid' });
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('attaches a screenshot crop to the pending feedback', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });

    await expect(captured(sampleFeedback(), 1)).resolves.toEqual({ ok: true });
    expect((await getPendingFeedback(1))?.extras?.screenshot).toEqual(shot);
  });

  it('keeps the content-script extras when the screenshot lands', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const item: PickerFeedback = {
      ...sampleFeedback(),
      extras: { component: 'CheckoutButton', aria: { role: 'button', name: 'Checkout' } },
    };

    await expect(captured(item, 1)).resolves.toEqual({ ok: true });
    expect((await getPendingFeedback(1))?.extras).toEqual({
      component: 'CheckoutButton',
      aria: { role: 'button', name: 'Checkout' },
      screenshot: shot,
    });
  });

  it('stores the feedback without a screenshot when the capture is skipped', async () => {
    setElementScreenshotter({ captureFor: vi.fn(async () => null) });
    const item = sampleFeedback();

    await expect(captured(item, 1)).resolves.toEqual({ ok: true });
    expect(await getPendingFeedback(1)).toEqual(item);
  });

  it('passes the sender window to the screenshotter', async () => {
    const captureFor = vi.fn(async () => null);
    setElementScreenshotter({ captureFor });
    const item = sampleFeedback();

    await expect(captured(item, 1, 7)).resolves.toEqual({ ok: true });
    expect(captureFor).toHaveBeenCalledWith(item, {
      windowId: 7,
      isVisible: expect.any(Function),
    });
  });

  it('checks the sender tab against the visible tab before capturing', async () => {
    const captureFor = vi.fn<ElementScreenshotter['captureFor']>(async () => null);
    setElementScreenshotter({ captureFor });
    stubQuery([tab(9)]);

    await captured(sampleFeedback(), 1, 7);

    const request = captureFor.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    await expect(request?.isVisible()).resolves.toBe(false);

    stubQuery([tab(1)]);
    await expect(request?.isVisible()).resolves.toBe(true);
  });

  it('rejects the capture when consent is revoked while the screenshot is taken', async () => {
    const captureFor = vi.fn(async () => {
      await declineConsent();
      return { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    });
    setElementScreenshotter({ captureFor });

    await expect(captured(sampleFeedback(), 1)).resolves.toEqual({
      ok: false,
      error: CONSENT_REQUIRED_ERROR,
    });
    expect(captureFor).toHaveBeenCalled();
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('clears the pending capture when its tab closes', async () => {
    await captured(sampleFeedback(), 1);
    expect(await getPendingFeedback(1)).not.toBeNull();

    await triggerEvent(browser.tabs.onRemoved, 1, { isWindowClosing: false, windowId: 0 });

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('leaves messages for other modules alone', async () => {
    browser.runtime.onMessage.addListener((_message: unknown, _sender, sendResponse) => {
      sendResponse('other module');
      return true;
    });

    await expect(browser.runtime.sendMessage({ type: 'connection/status' })).resolves.toBe('other module');
  });

  describe('before the feedback disclosure is accepted', () => {
    beforeEach(() => {
      fakeBrowser.reset();
      registerPickerMessageHandler();
      setElementScreenshotter({ captureFor: vi.fn(async () => null) });
    });

    it('refuses to arm the picker', async () => {
      stubQuery([tab(7)]);
      const send = stubSendMessage({ ok: true, armed: true });

      await expect(armPickerOnActiveTab()).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });
      expect(send).not.toHaveBeenCalled();
    });

    it('refuses to arm the picker from a surface', async () => {
      stubQuery([tab(7)]);
      stubSendMessage({ ok: true, armed: true });

      await expect(requestArmPicker()).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });
    });

    it('refuses to arm the picker after a decline', async () => {
      await declineConsent();
      stubQuery([tab(7)]);

      await expect(armPickerOnActiveTab()).resolves.toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });
    });

    it('refuses to hold a capture', async () => {
      const captureFor = vi.fn(async () => null);
      setElementScreenshotter({ captureFor });

      await expect(notifyCaptured(sampleFeedback())).resolves.toEqual({
        ok: false,
        error: CONSENT_REQUIRED_ERROR,
      });
      expect(await getPendingFeedback(1)).toBeNull();
      expect(captureFor).not.toHaveBeenCalled();
    });
  });
});
