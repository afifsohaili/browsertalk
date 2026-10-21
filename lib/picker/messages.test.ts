import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONSENT_REQUIRED_ERROR, acceptConsent, declineConsent } from '@/lib/consent/consent';
import { getPendingFeedback, setPendingFeedback } from '@/lib/storage/pending';
import { CAPTURE_WINDOW_MS, createCaptureBudget } from './capture-budget';
import type { PickerFeedback } from './facts';
import {
  armPickerOnActiveTab,
  armPickerOnTab,
  registerPickerMessageHandler,
  respondToPickerRequest,
  setElementScreenshotter,
} from './handler';
import { notifyCaptured, notifyCleared, requestArmPicker } from './messages';
import { createElementScreenshotter, type ElementScreenshotter } from './screenshot';

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
    elements: [
      {
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
      },
    ],
  };
}

function captured(
  feedback: PickerFeedback,
  tabId: number,
  options: { windowId?: number; index?: number } = {},
): ReturnType<typeof respondToPickerRequest> {
  const context = options.windowId === undefined ? { tabId } : { tabId, windowId: options.windowId };
  return respondToPickerRequest(
    { type: 'picker/captured', feedback, elementIndex: options.index ?? 0 },
    context,
  );
}

function cleared(setID: string, tabId = 1): ReturnType<typeof respondToPickerRequest> {
  return respondToPickerRequest({ type: 'picker/cleared', setID }, { tabId });
}

function pickedElement(selector: string, text: string): PickerFeedback['elements'][number] {
  const base = sampleFeedback().elements[0]!;
  return { element: { ...base.element, selector, text } };
}

function indexed(feedback: PickerFeedback): PickerFeedback {
  return { ...feedback, elements: feedback.elements.map((entry, index) => ({ ...entry, index })) };
}

function budgetedScreenshotter() {
  let time = 0;
  const sleeps: number[] = [];
  const budget = createCaptureBudget({
    now: () => time,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
  });
  const captureTab = vi.fn(async () => 'data:image/png;base64,AAAA');
  const screenshotter = createElementScreenshotter({
    captureTab,
    crop: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,BBBB', width: 10, height: 10 })),
    budget,
  });
  return { screenshotter, captureTab, budget, sleeps };
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
    expect(await getPendingFeedback(1)).toEqual(indexed(item));
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
    await expect(
      respondToPickerRequest({ type: 'picker/captured', feedback: sampleFeedback(), elementIndex: 0 }),
    ).resolves.toEqual({
      ok: false,
      error: 'No page sent this capture',
    });
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('merges each picked element into the tab set by index', async () => {
    const first: PickerFeedback = { ...sampleFeedback(), elements: [pickedElement('button#first', 'First')] };
    const second: PickerFeedback = { ...sampleFeedback(), elements: [pickedElement('button#second', 'Second')] };

    await expect(captured(first, 1, { index: 0 })).resolves.toEqual({ ok: true });
    await expect(captured(second, 1, { index: 1 })).resolves.toEqual({ ok: true });

    const pending = await getPendingFeedback(1);
    expect(pending?.id).toBe('fb_1');
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#first', 'button#second']);
  });

  it('replaces the element at an index that already landed', async () => {
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#first', 'First')] }, 1, { index: 0 });
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#again', 'Again')] }, 1, { index: 0 });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#again']);
  });

  it('keeps pick order when the captures land out of order', async () => {
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#third', 'Third')] }, 1, { index: 2 });
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#first', 'First')] }, 1, { index: 0 });
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#second', 'Second')] }, 1, { index: 1 });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual([
      'button#first',
      'button#second',
      'button#third',
    ]);
  });

  it('clears the pending set named by the clear message', async () => {
    await captured(sampleFeedback(), 1);

    await expect(cleared('fb_1')).resolves.toEqual({ ok: true });

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('leaves a newer set alone when an older set is cleared', async () => {
    await captured(sampleFeedback(), 1);

    await expect(cleared('fb_other')).resolves.toEqual({ ok: true });

    expect((await getPendingFeedback(1))?.id).toBe('fb_1');
  });

  it('rejects a clear that does not name the sender tab', async () => {
    await captured(sampleFeedback(), 1);

    await expect(
      respondToPickerRequest({ type: 'picker/cleared', setID: 'fb_1' }),
    ).resolves.toEqual({ ok: false, error: 'No page sent this capture' });
    expect((await getPendingFeedback(1))?.id).toBe('fb_1');
  });

  it('does not let an in-flight capture land after its set was cleared', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setElementScreenshotter({
      captureFor: vi.fn(async () => {
        await gate;
        return null;
      }),
    });

    const capture = captured(sampleFeedback(), 1);
    const clear = cleared('fb_1');
    release();
    await Promise.all([capture, clear]);

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('attaches the screenshot to the element at its index', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });

    await captured({ ...sampleFeedback(), elements: [pickedElement('button#first', 'First')] }, 1, { index: 0 });
    await captured({ ...sampleFeedback(), elements: [pickedElement('button#second', 'Second')] }, 1, { index: 1 });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements[0]?.extras?.screenshot).toEqual(shot);
    expect(pending?.elements[1]?.extras?.screenshot).toEqual(shot);
  });

  it('rejects a capture without a valid element index', async () => {
    for (const elementIndex of [undefined, -1, 1.5, '0']) {
      const response = await browser.runtime.sendMessage({
        type: 'picker/captured',
        feedback: sampleFeedback(),
        elementIndex,
      });

      expect(response).toEqual({ ok: false, error: 'The captured element index was invalid' });
    }

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('sends the picked index with the capture', async () => {
    const originalSendMessage = browser.runtime.sendMessage;
    const send = vi.fn(async () => ({ ok: true }));
    browser.runtime.sendMessage = send as unknown as typeof browser.runtime.sendMessage;
    const item = sampleFeedback();

    await expect(notifyCaptured(item, 0)).resolves.toEqual({ ok: true });

    expect(send).toHaveBeenCalledWith({ type: 'picker/captured', feedback: item, elementIndex: 0 });
    browser.runtime.sendMessage = originalSendMessage;
  });

  it('sends the set id when the picker clears a set', async () => {
    const originalSendMessage = browser.runtime.sendMessage;
    const send = vi.fn(async () => ({ ok: true }));
    browser.runtime.sendMessage = send as unknown as typeof browser.runtime.sendMessage;

    await expect(notifyCleared('fb_set')).resolves.toEqual({ ok: true });

    expect(send).toHaveBeenCalledWith({ type: 'picker/cleared', setID: 'fb_set' });
    browser.runtime.sendMessage = originalSendMessage;
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
    expect((await getPendingFeedback(1))?.elements[0]?.extras?.screenshot).toEqual(shot);
  });

  it('attaches the screenshot to the first element of a set only', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const set = sampleFeedback();
    set.elements.push({ element: { ...set.elements[0]!.element, selector: 'button#pay', text: 'Pay' } });

    await expect(captured(set, 1)).resolves.toEqual({ ok: true });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements[0]?.extras?.screenshot).toEqual(shot);
    expect(pending?.elements[1]?.extras).toBeUndefined();
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#checkout', 'button#pay']);
  });

  it('captures at most twice in the first second of a rapid four-pick burst', async () => {
    const { screenshotter, captureTab } = budgetedScreenshotter();
    setElementScreenshotter(screenshotter);
    const picks = ['first', 'second', 'third', 'fourth'].map((name) => ({
      ...sampleFeedback(),
      elements: [pickedElement(`button#${name}`, name)],
    }));

    const results = await Promise.all(picks.map((item, index) => captured(item, 1, { index })));

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    expect(captureTab).toHaveBeenCalledTimes(2);

    const pending = await getPendingFeedback(1);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual([
      'button#first',
      'button#second',
      'button#third',
      'button#fourth',
    ]);
    expect(pending?.elements.map((entry) => entry.extras?.screenshot !== undefined)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('waits for a token before a lone pick', async () => {
    const { screenshotter, captureTab, budget, sleeps } = budgetedScreenshotter();
    budget.tryAcquire();
    budget.tryAcquire();
    setElementScreenshotter(screenshotter);

    await expect(captured(sampleFeedback(), 1, { index: 0 })).resolves.toEqual({ ok: true });

    expect(captureTab).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([CAPTURE_WINDOW_MS + 1]);
    expect((await getPendingFeedback(1))?.elements[0]?.extras?.screenshot).toBeDefined();
  });

  it('keeps the fifth element without a capture', async () => {
    const captureFor = vi.fn<ElementScreenshotter['captureFor']>(async () => ({
      dataUrl: 'data:image/png;base64,BBBB',
      width: 10,
      height: 10,
    }));
    setElementScreenshotter({ captureFor });

    await expect(
      captured({ ...sampleFeedback(), elements: [pickedElement('button#fifth', 'Fifth')] }, 1, { index: 4 }),
    ).resolves.toEqual({ ok: true });

    expect(captureFor).not.toHaveBeenCalled();
    expect((await getPendingFeedback(1))?.elements[0]?.extras).toBeUndefined();
  });

  it('allows waiting only for the first pick of a set', async () => {
    const captureFor = vi.fn<ElementScreenshotter['captureFor']>(async () => null);
    setElementScreenshotter({ captureFor });
    const item = sampleFeedback();

    await captured(item, 1, { index: 0 });
    await captured(item, 1, { index: 1 });
    await captured(item, 1, { index: 3 });

    expect(captureFor.mock.calls.map(([, , options]) => options)).toEqual([
      { allowWait: true },
      { allowWait: false },
      { allowWait: false },
    ]);
  });

  it('keeps the content-script extras when the screenshot lands', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const item: PickerFeedback = {
      ...sampleFeedback(),
      elements: [
        {
          ...sampleFeedback().elements[0]!,
          extras: { component: 'CheckoutButton', aria: { role: 'button', name: 'Checkout' } },
        },
      ],
    };

    await expect(captured(item, 1)).resolves.toEqual({ ok: true });
    expect((await getPendingFeedback(1))?.elements[0]?.extras).toEqual({
      component: 'CheckoutButton',
      aria: { role: 'button', name: 'Checkout' },
      screenshot: shot,
    });
  });

  it('stores the feedback without a screenshot when the capture is skipped', async () => {
    setElementScreenshotter({ captureFor: vi.fn(async () => null) });
    const item = sampleFeedback();

    await expect(captured(item, 1)).resolves.toEqual({ ok: true });
    expect(await getPendingFeedback(1)).toEqual(indexed(item));
  });

  it('drops the screenshot and keeps the capture when pending storage is full', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const setSpy = vi.spyOn(browser.storage.session, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(captured(sampleFeedback(), 1)).resolves.toEqual({ ok: true });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements[0]?.extras?.screenshot).toBeUndefined();
    expect(pending?.id).toBe('fb_1');
    expect(setSpy).toHaveBeenCalledTimes(2);
    setSpy.mockRestore();
  });

  it('reports an error when the capture cannot be stored without the screenshot either', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const setSpy = vi.spyOn(browser.storage.session, 'set').mockRejectedValue(new Error('quota exceeded'));

    await expect(captured(sampleFeedback(), 1)).rejects.toThrow('quota exceeded');

    expect(await getPendingFeedback(1)).toBeNull();
    setSpy.mockRestore();
  });

  it('never overwrites a newer capture when an older screenshot write hits the quota', async () => {
    const shot = { dataUrl: 'data:image/png;base64,BBBB', width: 240, height: 64 };
    setElementScreenshotter({ captureFor: vi.fn(async () => shot) });
    const originalSet = browser.storage.session.set.bind(browser.storage.session);
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const setSpy = vi
      .spyOn(browser.storage.session, 'set')
      .mockImplementationOnce(async () => {
        started();
        await gate;
        throw new Error('QUOTA_BYTES quota exceeded');
      })
      .mockImplementation(originalSet);

    const oldCapture = captured(sampleFeedback(), 1);
    await entered;
    const replacement = setPendingFeedback(1, { ...sampleFeedback(), id: 'fb_new' });
    release();
    await replacement;

    await expect(oldCapture).resolves.toEqual({ ok: true });
    expect((await getPendingFeedback(1))?.id).toBe('fb_new');
    setSpy.mockRestore();
  });

  it('passes the sender window to the screenshotter', async () => {
    const captureFor = vi.fn(async () => null);
    setElementScreenshotter({ captureFor });
    const item = sampleFeedback();

    await expect(captured(item, 1, { windowId: 7 })).resolves.toEqual({ ok: true });
    expect(captureFor).toHaveBeenCalledWith(
      item,
      {
        windowId: 7,
        isVisible: expect.any(Function),
      },
      { allowWait: true },
    );
  });

  it('checks the sender tab against the visible tab before capturing', async () => {
    const captureFor = vi.fn<ElementScreenshotter['captureFor']>(async () => null);
    setElementScreenshotter({ captureFor });
    stubQuery([tab(9)]);

    await captured(sampleFeedback(), 1, { windowId: 7 });

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

      await expect(notifyCaptured(sampleFeedback(), 0)).resolves.toEqual({
        ok: false,
        error: CONSENT_REQUIRED_ERROR,
      });
      expect(await getPendingFeedback(1)).toBeNull();
      expect(captureFor).not.toHaveBeenCalled();
    });
  });
});
