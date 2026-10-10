import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PickerFeedback } from '@/lib/picker/facts';
import { clearPendingFeedback, getPendingFeedback, setPendingFeedback } from './pending';

function feedback(): PickerFeedback {
  return {
    id: 'fb_1',
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
    expect(await getPendingFeedback()).toBeNull();
  });

  it('stores and reads back the feedback under pending.feedback in session storage', async () => {
    const item = feedback();
    await setPendingFeedback(item);

    expect(await getPendingFeedback()).toEqual(item);
    expect(await browser.storage.session.get('pending.feedback')).toEqual({ 'pending.feedback': item });
  });

  it('treats junk values as absent', async () => {
    await browser.storage.session.set({ 'pending.feedback': 42 });

    expect(await getPendingFeedback()).toBeNull();
  });

  it('clears the pending feedback', async () => {
    await setPendingFeedback(feedback());
    await clearPendingFeedback();

    expect(await getPendingFeedback()).toBeNull();
  });
});
