import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acceptConsent } from '@/lib/consent/consent';
import type { PickerFeedback } from '@/lib/picker/facts';
import {
  registerPickerMessageHandler,
  respondToPickerRequest,
  setElementScreenshotter,
} from '@/lib/picker/messages';
import { renderPrompt } from '@/lib/send/prompt';
import { resetSendDispatcher, setSendDispatcher } from '@/lib/send/trigger';
import { readOutbox } from '@/lib/storage/outbox';
import { getPendingFeedback } from '@/lib/storage/pending';
import { registerComposerHandler, respondToComposerRequest } from './messages';

const SET_ID = 'fb_set';

function shotFor(selector: string): string {
  const tag = selector.replace(/[^a-z0-9]/gi, '');
  return `data:image/png;base64,${Buffer.from(tag).toString('base64')}`;
}

function picked(selector: string, text: string): PickerFeedback {
  return {
    id: SET_ID,
    capturedAt: '2026-10-21T09:00:00.000Z',
    page: { url: 'https://example.com/pricing', path: '/pricing', query: [], title: 'Pricing' },
    elements: [
      {
        element: {
          tag: selector.split('#')[0] ?? 'div',
          id: selector.includes('#') ? selector.split('#')[1]! : null,
          classes: [],
          selector,
          text,
          attributes: {},
          box: { x: 10, y: 20, width: 120, height: 32 },
          viewport: { width: 1280, height: 800 },
          scroll: { x: 0, y: 0 },
        },
      },
    ],
  };
}

function capture(feedback: PickerFeedback, elementIndex: number): Promise<unknown> {
  return respondToPickerRequest({ type: 'picker/captured', feedback, elementIndex }, { tabId: 1 });
}

function queue(comment: string, elementCount: number): Promise<unknown> {
  return respondToComposerRequest(
    {
      type: 'composer/queue',
      comment,
      page: { url: 'https://example.com/pricing', title: 'Pricing' },
      captureID: SET_ID,
      elementCount,
    },
    { tabId: 1 },
  );
}

function remove(index: number): Promise<unknown> {
  return respondToComposerRequest({ type: 'composer/remove', captureID: SET_ID, index }, { tabId: 1 });
}

async function pickThreeOutOfOrder(): Promise<void> {
  await capture(picked('h1', 'Plans that scale'), 2);
  await capture(picked('button#start-trial', 'Start a 14-day trial'), 0);
  await capture(picked('article.card', 'Starter plan'), 1);
}

describe('multi-element set end to end', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await acceptConsent();
    registerPickerMessageHandler();
    registerComposerHandler();
    setElementScreenshotter({
      captureFor: vi.fn(async (feedback: PickerFeedback) => ({
        dataUrl: shotFor(feedback.elements[0]!.element.selector),
        width: 120,
        height: 32,
      })),
    });
    setSendDispatcher(() => {});
  });

  afterEach(() => {
    setElementScreenshotter(null);
    resetSendDispatcher();
  });

  it('queues one outbox item with three ordered elements and attachments', async () => {
    await pickThreeOutOfOrder();

    const pending = await getPendingFeedback(1);
    expect(pending?.id).toBe(SET_ID);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual([
      'button#start-trial',
      'article.card',
      'h1',
    ]);
    expect(pending?.elements.map((entry) => entry.extras?.screenshot?.dataUrl)).toEqual([
      shotFor('button#start-trial'),
      shotFor('article.card'),
      shotFor('h1'),
    ]);

    await expect(queue('All three look off', 3)).resolves.toEqual({ ok: true, outboxCount: 1 });

    const items = await readOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]?.facts.elements).toHaveLength(3);
    expect(items[0]?.facts.elements?.map((entry) => entry.element.selector)).toEqual([
      'button#start-trial',
      'article.card',
      'h1',
    ]);
    expect(items[0]?.facts.elements?.every((entry) => entry.extras?.screenshot !== undefined)).toBe(true);
    expect(await getPendingFeedback(1)).toBeNull();

    const prompt = renderPrompt({ projectName: 'example', item: items[0]! });
    expect(prompt).toContain('Elements (3):');
    expect(prompt).toContain('1. button — "Start a 14-day trial"');
    expect(prompt).toContain('2. article.card — "Starter plan"');
    expect(prompt).toContain('3. h1 — "Plans that scale"');
    expect(prompt).not.toContain('index');
  });

  it('queues the remaining two after one chip is removed', async () => {
    await pickThreeOutOfOrder();

    await expect(remove(1)).resolves.toEqual({ ok: true, elementCount: 2 });

    const pending = await getPendingFeedback(1);
    expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#start-trial', 'h1']);

    await expect(queue('Two problems', 2)).resolves.toEqual({ ok: true, outboxCount: 1 });

    const item = (await readOutbox())[0];
    expect(item?.facts.elements).toHaveLength(2);
    expect(item?.facts.elements?.map((entry) => entry.element.selector)).toEqual(['button#start-trial', 'h1']);

    const prompt = renderPrompt({ projectName: 'example', item: item! });
    expect(prompt).toContain('Elements (2):');
  });

  it('serialises a chip removal behind a capture that is still in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setElementScreenshotter({
      captureFor: vi.fn(async (feedback: PickerFeedback) => {
        if (feedback.elements[0]!.element.selector === 'h1') await gate;
        return {
          dataUrl: shotFor(feedback.elements[0]!.element.selector),
          width: 120,
          height: 32,
        };
      }),
    });

    await capture(picked('button#start-trial', 'Start a 14-day trial'), 0);
    const inFlight = capture(picked('h1', 'Plans that scale'), 1);
    const removal = remove(0);

    let removed = false;
    void removal.then(() => {
      removed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(removed).toBe(false);

    release();
    await inFlight;

    await expect(removal).resolves.toEqual({ ok: true, elementCount: 1 });
    expect((await getPendingFeedback(1))?.elements.map((entry) => entry.element.selector)).toEqual(['h1']);

    await expect(queue('Only the heading', 1)).resolves.toEqual({ ok: true, outboxCount: 1 });
    expect((await readOutbox())[0]?.facts.elements?.map((entry) => entry.element.selector)).toEqual(['h1']);
  });

  it('rejects the queue when the set count no longer matches the pending set', async () => {
    await pickThreeOutOfOrder();
    await remove(1);

    await expect(queue('Still three', 3)).resolves.toEqual({
      ok: false,
      error: 'The element set changed — pick again',
    });

    expect(await readOutbox()).toEqual([]);
    expect((await getPendingFeedback(1))?.elements).toHaveLength(2);
  });

  it('keeps a single-element set on the compact prompt', async () => {
    await capture(picked('button#start-trial', 'Start a 14-day trial'), 0);

    await expect(queue('Button is misaligned', 1)).resolves.toEqual({ ok: true, outboxCount: 1 });

    const prompt = renderPrompt({ projectName: 'example', item: (await readOutbox())[0]! });
    expect(prompt).toContain('Element: button — "Start a 14-day trial" · button#start-trial');
    expect(prompt).not.toContain('Elements (');
  });

  it('clears the pending set when the picker cancels', async () => {
    await pickThreeOutOfOrder();

    await expect(
      respondToPickerRequest({ type: 'picker/cleared', setID: SET_ID }, { tabId: 1 }),
    ).resolves.toEqual({ ok: true });

    expect(await getPendingFeedback(1)).toBeNull();
    await expect(queue('Nothing left', 3)).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });
  });
});
