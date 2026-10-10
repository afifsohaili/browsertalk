import { describe, expect, it } from 'vitest';
import type { PickerFeedback } from '@/lib/picker/facts';
import { buildElementOutboxItem, buildPageOutboxItem } from './assemble';

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
    element: {
      tag: 'button',
      id: 'checkout',
      classes: ['btn'],
      selector: 'button#checkout',
      text: 'Checkout',
      attributes: { role: 'button' },
      box: { x: 10, y: 20, width: 120, height: 32 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

describe('outbox item assembly', () => {
  it('builds an element item from the picked feedback', () => {
    const pending: PickerFeedback = {
      ...pendingFeedback(),
      extras: { component: 'CheckoutButton', aria: { role: 'button', name: 'Checkout' } },
    };

    const item = buildElementOutboxItem(pending, 'Button is misaligned', { id: 'ob_1', now: '2026-10-10T09:10:00.000Z' });

    expect(item).toEqual({
      id: 'ob_1',
      comment: 'Button is misaligned',
      capturedAt: '2026-10-10T09:00:00.000Z',
      status: 'queued',
      facts: {
        page: pending.page,
        element: pending.element,
        extras: pending.extras,
      },
    });
  });

  it('omits extras when the picked feedback has none', () => {
    const item = buildElementOutboxItem(pendingFeedback(), 'No extras here', { id: 'ob_2', now: '2026-10-10T09:10:00.000Z' });

    expect(Object.keys(item.facts).sort()).toEqual(['element', 'page']);
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
    expect('element' in item.facts).toBe(false);
  });
});
