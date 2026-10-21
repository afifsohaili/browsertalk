import { describe, expect, it } from 'vitest';
import type { PickerElementCapture, PickerElementFacts, PickerFeedback, PickerScreenshotFacts } from '@/lib/picker/facts';
import type { OutboxItem } from '@/lib/storage/outbox';
import { buildElementOutboxItem, buildPageOutboxItem, withoutScreenshot } from './assemble';

const SHOT: PickerScreenshotFacts = { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 };

function element(overrides: Partial<PickerElementFacts> = {}): PickerElementFacts {
  return {
    tag: 'button',
    id: 'checkout',
    classes: ['btn'],
    selector: 'button#checkout',
    text: 'Checkout',
    attributes: { role: 'button' },
    box: { x: 10, y: 20, width: 120, height: 32 },
    viewport: { width: 1280, height: 800 },
    scroll: { x: 0, y: 0 },
    ...overrides,
  };
}

function pendingFeedback(): PickerFeedback {
  return {
    id: 'fb_1',
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: {
      url: 'https://example.com/cart?step=2',
      path: '/cart',
      query: [{ name: 'step', value: '2' }],
      title: 'Cart',
    },
    elements: [{ element: element() }],
  };
}

describe('outbox item assembly', () => {
  it('builds an element item from the picked feedback', () => {
    const pending: PickerFeedback = {
      ...pendingFeedback(),
      elements: [{ element: element(), extras: { component: 'CheckoutButton', aria: { role: 'button', name: 'Checkout' } } }],
    };

    const item = buildElementOutboxItem(pending, 'Button is misaligned', { id: 'ob_1', now: '2026-10-10T09:10:00.000Z' });

    expect(item).toEqual({
      id: 'ob_1',
      comment: 'Button is misaligned',
      capturedAt: '2026-10-10T09:00:00.000Z',
      status: 'queued',
      facts: {
        page: pending.page,
        elements: pending.elements,
      },
    });
  });

  it('copies the ordered element set', () => {
    const pending: PickerFeedback = {
      ...pendingFeedback(),
      elements: [
        { element: element(), extras: { screenshot: SHOT } },
        { element: element({ tag: 'h1', id: null, selector: 'h1', text: 'Cart' }) },
        { element: element({ tag: 'p', id: null, selector: 'p', text: 'Total' }) },
      ],
    };

    const item = buildElementOutboxItem(pending, 'Three things', { id: 'ob_set', now: '2026-10-10T09:10:00.000Z' });
    pending.elements.push({ element: element({ selector: 'footer' }) });

    expect(item.facts.elements?.map((entry) => entry.element.selector)).toEqual([
      'button#checkout',
      'h1',
      'p',
    ]);
    expect(item.facts.elements?.[0]?.extras?.screenshot).toEqual(SHOT);
    expect(item.facts).not.toHaveProperty('element');
    expect(item.facts).not.toHaveProperty('extras');
  });

  it('omits extras when the picked feedback has none', () => {
    const item = buildElementOutboxItem(pendingFeedback(), 'No extras here', { id: 'ob_2', now: '2026-10-10T09:10:00.000Z' });

    expect(Object.keys(item.facts).sort()).toEqual(['elements', 'page']);
    expect(item.facts.elements).toEqual([{ element: element() }]);
  });

  it('builds a comment-on-page item with just the parsed page facts', () => {
    const item = buildPageOutboxItem(
      { url: 'https://example.com/cart?step=2#pay', title: ' Cart ' },
      'The layout jumps',
      { id: 'ob_3', now: '2026-10-10T09:11:00.000Z' },
    );

    expect(item).toEqual({
      id: 'ob_3',
      comment: 'The layout jumps',
      capturedAt: '2026-10-10T09:11:00.000Z',
      status: 'queued',
      facts: {
        page: {
          url: 'https://example.com/cart?step=2#pay',
          path: '/cart',
          query: [{ name: 'step', value: '2' }],
          title: 'Cart',
        },
      },
    });
  });

  it('builds a URL-only item with an empty comment', () => {
    const item = buildPageOutboxItem({ url: 'https://example.com/', title: 'Example' }, '', {
      id: 'ob_4',
      now: '2026-10-10T09:12:00.000Z',
    });

    expect(item.comment).toBe('');
    expect(item.facts).toEqual({
      page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' },
    });
    expect('elements' in item.facts).toBe(false);
  });
});

describe('screenshot stripping', () => {
  function setItem(shots: boolean[]): OutboxItem {
    const pending: PickerFeedback = {
      ...pendingFeedback(),
      elements: shots.map((hasShot, index) => ({
        element: element({ selector: `div.item-${index + 1}` }),
        ...(hasShot
          ? { extras: { screenshot: { ...SHOT, width: 100 + index }, component: `Item${index + 1}` } }
          : {}),
      })),
    };
    return buildElementOutboxItem(pending, 'Set', { id: 'ob_set', now: '2026-10-10T09:10:00.000Z' });
  }

  it('strips the last element screenshot and keeps its other extras', () => {
    const stripped = withoutScreenshot(setItem([true, true]));

    expect(stripped.facts.elements?.[0]?.extras?.screenshot).toBeDefined();
    expect(stripped.facts.elements?.[1]?.extras).toEqual({ component: 'Item2' });
  });

  it('drops the extras object when the screenshot was the only extra', () => {
    const item = setItem([false, false]);
    item.facts.elements![1]!.extras = { screenshot: SHOT };

    expect(withoutScreenshot(item).facts.elements?.[1]?.extras).toBeUndefined();
  });

  it('walks backward to the last element that has a screenshot', () => {
    const stripped = withoutScreenshot(setItem([true, false]));

    expect(stripped.facts.elements?.[0]?.extras).toEqual({ component: 'Item1' });
    expect(stripped.facts.elements?.[1]?.extras).toBeUndefined();
  });

  it('strips one screenshot per call', () => {
    const once = withoutScreenshot(setItem([true, true, true]));
    const twice = withoutScreenshot(once);

    expect(once.facts.elements?.filter((entry) => entry.extras?.screenshot !== undefined)).toHaveLength(2);
    expect(twice.facts.elements?.filter((entry) => entry.extras?.screenshot !== undefined)).toHaveLength(1);
  });

  it('strips a five-element set from the fourth element backward', () => {
    const four = withoutScreenshot(setItem([true, true, true, true, false]));
    expect(four.facts.elements?.map((entry) => entry.extras?.screenshot !== undefined)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);

    const two = withoutScreenshot(four);
    const one = withoutScreenshot(two);
    const none = withoutScreenshot(one);

    expect(two.facts.elements?.filter((entry) => entry.extras?.screenshot !== undefined)).toHaveLength(2);
    expect(one.facts.elements?.filter((entry) => entry.extras?.screenshot !== undefined)).toHaveLength(1);
    expect(none.facts.elements?.every((entry) => entry.extras?.screenshot === undefined)).toBe(true);
  });

  it('leaves a page-only or screenshot-free item alone', () => {
    const page = buildPageOutboxItem({ url: 'https://example.com/', title: 'Example' }, '', {
      id: 'ob_page',
      now: '2026-10-10T09:10:00.000Z',
    });
    const bare = setItem([false, false]);

    expect(withoutScreenshot(page)).toBe(page);
    expect(withoutScreenshot(bare)).toBe(bare);
  });
});
