import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PickerFeedback } from '@/lib/picker/facts';
import {
  clearPendingFeedback,
  getPendingFeedback,
  pendingFeedbackKey,
  setPendingFeedback,
} from './pending';

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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('never deletes a replacement written while an older cleanup reads', async () => {
    const key = pendingFeedbackKey(1);
    const stored: Record<string, unknown> = { [key]: feedback('fb_a') };
    let resolveRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      resolveRead = resolve;
    });
    let gated = false;

    const session = browser.storage.session as unknown as {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
    vi.spyOn(session, 'get').mockImplementation(async (key) => {
      const snapshot = { [key]: stored[key] };
      if (!gated) {
        gated = true;
        await readGate;
      }
      return snapshot;
    });
    vi.spyOn(session, 'set').mockImplementation(async (items) => {
      Object.assign(stored, items);
    });
    vi.spyOn(session, 'remove').mockImplementation(async (key) => {
      delete stored[key];
    });

    const cleanup = clearPendingFeedback(1, 'fb_a');
    const replacement = setPendingFeedback(1, feedback('fb_b'));
    resolveRead();
    await Promise.all([cleanup, replacement]);

    expect(stored[key]).toEqual(feedback('fb_b'));
    expect((await getPendingFeedback(1))?.id).toBe('fb_b');
  });

  it('applies a quota fallback before a replacement queued behind it', async () => {
    const key = pendingFeedbackKey(1);
    const stored: Record<string, unknown> = {};
    let calls = 0;
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const session = browser.storage.session as unknown as {
      set: (items: Record<string, unknown>) => Promise<void>;
    };
    vi.spyOn(session, 'set').mockImplementation(async (items) => {
      calls += 1;
      if (calls === 1) {
        started();
        await gate;
        throw new Error('QUOTA_BYTES quota exceeded');
      }
      Object.assign(stored, items);
    });

    const first = setPendingFeedback(1, feedback('fb_with_shot'), feedback('fb_without_shot'));
    await entered;
    const replacement = setPendingFeedback(1, feedback('fb_new'));
    release();
    await Promise.all([first, replacement]);

    expect(stored[key]).toEqual(feedback('fb_new'));
  });
});
