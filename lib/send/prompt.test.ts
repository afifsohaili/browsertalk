import { describe, expect, it } from 'vitest';
import type { OutboxItem } from '@/lib/storage/outbox';
import { renderPrompt } from './prompt';

const SENT_AT = '2026-10-10T09:06:00.000Z';

function elementItem(): OutboxItem {
  return {
    id: 'ob_1',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
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
        scroll: { x: 0, y: 40 },
      },
    },
  };
}

describe('renderPrompt', () => {
  it('renders the product.md template with the extras lines', () => {
    const item = elementItem();
    const withExtras: OutboxItem = {
      ...item,
      facts: {
        ...item.facts,
        extras: {
          component: 'CheckoutButton',
          styles: { display: 'flex', color: 'rgb(255, 255, 255)' },
          aria: { role: 'button', name: 'Checkout' },
        },
      },
    };

    expect(renderPrompt({ projectName: 'example', item: withExtras, sentAt: SENT_AT })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Element: button.btn.primary — "Checkout"',
        '  selector  button#checkout',
        '  box       120×32 @ (10,20) · viewport 1280×800 · scroll (0,40)',
        '  attrs     role=button · data-testid=checkout',
        '  component CheckoutButton',
        '  styles    display: flex · color: rgb(255, 255, 255)',
        '  aria      role=button · name=Checkout',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
        '',
        'Sent by Browsertalk · 2026-10-10T09:06:00.000Z',
      ].join('\n'),
    );
  });

  it('omits the extras lines when the pick has no extras', () => {
    expect(renderPrompt({ projectName: 'example', item: elementItem(), sentAt: SENT_AT })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Element: button.btn.primary — "Checkout"',
        '  selector  button#checkout',
        '  box       120×32 @ (10,20) · viewport 1280×800 · scroll (0,40)',
        '  attrs     role=button · data-testid=checkout',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
        '',
        'Sent by Browsertalk · 2026-10-10T09:06:00.000Z',
      ].join('\n'),
    );
  });

  it('renders each extras line only when that extra is present', () => {
    const item = elementItem();
    const componentOnly: OutboxItem = {
      ...item,
      facts: {
        ...item.facts,
        element: { ...item.facts.element!, attributes: {} },
        extras: { component: 'CheckoutButton' },
      },
    };

    expect(renderPrompt({ projectName: 'example', item: componentOnly, sentAt: SENT_AT })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Element: button.btn.primary — "Checkout"',
        '  selector  button#checkout',
        '  box       120×32 @ (10,20) · viewport 1280×800 · scroll (0,40)',
        '  component CheckoutButton',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
        '',
        'Sent by Browsertalk · 2026-10-10T09:06:00.000Z',
      ].join('\n'),
    );
  });

  it('renders an aria-only element line without inventing the missing half', () => {
    const item = elementItem();
    const ariaOnly: OutboxItem = {
      ...item,
      facts: { ...item.facts, extras: { aria: { name: 'Checkout' } } },
    };

    expect(renderPrompt({ projectName: 'example', item: ariaOnly, sentAt: SENT_AT })).toContain(
      '  aria      name=Checkout',
    );
    expect(renderPrompt({ projectName: 'example', item: ariaOnly, sentAt: SENT_AT })).not.toContain('aria      role=');
  });

  it('drops the attrs line when the element has no key attributes', () => {
    const item = elementItem();
    const bare: OutboxItem = {
      ...item,
      facts: { ...item.facts, element: { ...item.facts.element!, classes: [], attributes: {} } },
    };

    const rendered = renderPrompt({ projectName: 'example', item: bare, sentAt: SENT_AT });
    expect(rendered).toContain('Element: button — "Checkout"');
    expect(rendered).not.toContain('attrs');
  });

  it('renders a page-only item without an Element block or comment text', () => {
    const item: OutboxItem = {
      id: 'ob_2',
      comment: '',
      capturedAt: '2026-10-10T09:00:00.000Z',
      status: 'queued',
      facts: {
        page: {
          url: 'https://example.com/page?q=1',
          path: '/page',
          query: [{ name: 'q', value: '1' }],
          title: 'Page',
        },
      },
    };

    expect(renderPrompt({ projectName: 'example', item, sentAt: SENT_AT })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment:',
        '',
        'Page: https://example.com/page?q=1',
        '  title     Page',
        '',
        'Sent by Browsertalk · 2026-10-10T09:06:00.000Z',
      ].join('\n'),
    );
  });

  it('keeps a multi-line comment intact', () => {
    const item = { ...elementItem(), comment: 'First line\nsecond line' };

    expect(renderPrompt({ projectName: 'example', item, sentAt: SENT_AT })).toContain(
      'Comment: First line\nsecond line',
    );
  });
});
