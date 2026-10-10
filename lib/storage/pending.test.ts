import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PickerFeedback } from '@/lib/picker/facts';
import { clearPendingFeedback, getPendingFeedback, setPendingFeedback } from './pending';

function feedback(id = 'fb_1'): PickerFeedback {
  return {
    id,
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' },
    element: {
      tag: 'button',
      id: null,
      classes: [],
      selector: 'button',
      text: 'Go',
      attributes: {},
      box: { x: 0, y: 0, width: 10, height: 10 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

describe('pending feedback storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty before a capture', async () => {
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('stores and reads back the feedback per tab under pending.feedback.<tabId>', async () => {
    const first = feedback('fb_a');
    const second = feedback('fb_b');
    await setPendingFeedback(1, first);
    await setPendingFeedback(2, second);

    expect(await getPendingFeedback(1)).toEqual(first);
    expect(await getPendingFeedback(2)).toEqual(second);
    expect(await browser.storage.session.get('pending.feedback.1')).toEqual({ 'pending.feedback.1': first });
    expect(await browser.storage.session.get('pending.feedback.2')).toEqual({ 'pending.feedback.2': second });
  });

  it('treats junk values as absent', async () => {
    await browser.storage.session.set({ 'pending.feedback.1': 42 });

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('clears the tab entry when no capture is named', async () => {
    await setPendingFeedback(1, feedback());
    await clearPendingFeedback(1);

    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('clears only the consumed capture', async () => {
    const pick = feedback('fb_a');
    await setPendingFeedback(1, pick);

    await clearPendingFeedback(1, 'fb_other');
    expect(await getPendingFeedback(1)).toEqual(pick);

    await clearPendingFeedback(1, 'fb_a');
    expect(await getPendingFeedback(1)).toBeNull();
  });

  it('keeps another tab pending feedback on clear', async () => {
    await setPendingFeedback(1, feedback('fb_a'));
    await setPendingFeedback(2, feedback('fb_b'));

    await clearPendingFeedback(1, 'fb_a');

    expect(await getPendingFeedback(1)).toBeNull();
    expect(await getPendingFeedback(2)).toEqual(feedback('fb_b'));
  });
});
