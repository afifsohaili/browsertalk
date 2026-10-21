import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PickerFeedback } from '@/lib/picker/facts';
import {
  clearPendingFeedback,
  getPendingFeedback,
  mergePendingElement,
  pendingFeedbackKey,
  setPendingFeedback,
} from './pending';

function feedback(id = 'fb_1'): PickerFeedback {
  return {
    id,
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' },
    elements: [
      {
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
      },
    ],
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

  it('treats an old single-element pending capture as absent', async () => {
    const { elements, ...rest } = feedback('fb_old');
    await browser.storage.session.set({
      'pending.feedback.1': { ...rest, element: elements[0]!.element },
    });

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

  describe('merging one picked element', () => {
    function picked(id: string, selector: string): PickerFeedback {
      const base = feedback(id);
      return { ...base, elements: [{ element: { ...base.elements[0]!.element, selector } }] };
    }

    it('initializes the tab set on the first pick', async () => {
      const pick = picked('fb_set', 'button#first');

      await mergePendingElement(1, pick, 0);

      expect(await getPendingFeedback(1)).toEqual(pick);
    });

    it('appends later picks in index order', async () => {
      await mergePendingElement(1, picked('fb_set', 'button#first'), 0);
      await mergePendingElement(1, picked('fb_set', 'button#second'), 1);
      await mergePendingElement(1, picked('fb_set', 'button#third'), 2);

      const pending = await getPendingFeedback(1);
      expect(pending?.elements.map((entry) => entry.element.selector)).toEqual([
        'button#first',
        'button#second',
        'button#third',
      ]);
    });

    it('keeps the set identity from the first pick', async () => {
      const first = picked('fb_set', 'button#first');
      await mergePendingElement(1, first, 0);
      const later: PickerFeedback = {
        ...picked('fb_set', 'button#second'),
        capturedAt: '2026-10-10T09:00:09.999Z',
        page: { url: 'https://example.com/other', path: '/other', query: [], title: 'Other' },
      };

      await mergePendingElement(1, later, 1);

      const pending = await getPendingFeedback(1);
      expect(pending?.id).toBe('fb_set');
      expect(pending?.capturedAt).toBe(first.capturedAt);
      expect(pending?.page).toEqual(first.page);
    });

    it('upserts the element at an index that already landed', async () => {
      await mergePendingElement(1, picked('fb_set', 'button#first'), 0);
      await mergePendingElement(1, picked('fb_set', 'button#second'), 1);

      await mergePendingElement(1, picked('fb_set', 'button#replaced'), 1);

      const pending = await getPendingFeedback(1);
      expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#first', 'button#replaced']);
    });

    it('clamps an index past the end so the set stays dense', async () => {
      await mergePendingElement(1, picked('fb_set', 'button#first'), 0);

      await mergePendingElement(1, picked('fb_set', 'button#gap'), 4);

      const pending = await getPendingFeedback(1);
      expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#first', 'button#gap']);
    });

    it('starts a new set when the feedback id changes', async () => {
      await mergePendingElement(1, picked('fb_old', 'button#old'), 0);

      await mergePendingElement(1, picked('fb_new', 'button#new'), 0);

      const pending = await getPendingFeedback(1);
      expect(pending?.id).toBe('fb_new');
      expect(pending?.elements.map((entry) => entry.element.selector)).toEqual(['button#new']);
    });

    it('writes the fallback set when the screenshot write hits the quota', async () => {
      const setSpy = vi.spyOn(browser.storage.session, 'set').mockRejectedValueOnce(new Error('quota exceeded'));
      const withShot = picked('fb_set', 'button#first');
      const withoutShot = picked('fb_set', 'button#first');

      await mergePendingElement(1, withShot, 0, withoutShot);

      expect(setSpy).toHaveBeenCalledTimes(2);
      expect((await getPendingFeedback(1))?.elements[0]?.element.selector).toBe('button#first');
      setSpy.mockRestore();
    });

    it('keeps a newer set written while an older screenshot write hits the quota', async () => {
      const key = pendingFeedbackKey(1);
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
        });

      const older = mergePendingElement(1, picked('fb_old', 'button#old'), 0, picked('fb_old', 'button#old'));
      await entered;
      const newer = setPendingFeedback(1, picked('fb_new', 'button#new'));
      release();
      await Promise.all([older, newer]);

      expect(await getPendingFeedback(1)).toEqual(picked('fb_new', 'button#new'));
      expect(await browser.storage.session.get(key)).toEqual({ [key]: picked('fb_new', 'button#new') });
      setSpy.mockRestore();
    });
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
