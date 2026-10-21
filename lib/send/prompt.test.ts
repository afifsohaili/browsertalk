import { describe, expect, it } from 'vitest';
import type { PickerElementCapture, PickerElementFacts, PickerExtras } from '@/lib/picker/facts';
import type { OutboxItem } from '@/lib/storage/outbox';
import { renderPrompt } from './prompt';

function element(overrides: Partial<PickerElementFacts> = {}): PickerElementFacts {
  return {
    tag: 'button',
    id: 'checkout',
    classes: ['btn', 'primary'],
    selector: 'button#checkout',
    text: 'Checkout',
    attributes: { role: 'button', 'data-testid': 'checkout' },
    box: { x: 10, y: 20, width: 120, height: 32 },
    viewport: { width: 1280, height: 800 },
    scroll: { x: 0, y: 40 },
    ...overrides,
  };
}

function capture(overrides: Partial<PickerElementFacts> = {}, extras?: PickerExtras): PickerElementCapture {
  return { element: element(overrides), ...(extras === undefined ? {} : { extras }) };
}

function elementItem(elements: PickerElementCapture[] = [capture()]): OutboxItem {
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
      elements,
    },
  };
}

describe('renderPrompt', () => {
  it('renders the compact single-element prompt with attrs and one extras line', () => {
    const item = elementItem([
      capture(
        {},
        {
          component: 'CheckoutButton',
          styles: { display: 'flex', color: 'rgb(255, 255, 255)' },
          aria: { role: 'button', name: 'Checkout' },
        },
      ),
    ]);

    expect(renderPrompt({ projectName: 'example', item })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Element: button.btn.primary — "Checkout" · button#checkout · role=button · data-testid=checkout',
        '  extras    component=CheckoutButton · role=button · name=Checkout · display=flex · color=rgb(255, 255, 255)',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
      ].join('\n'),
    );
  });

  it('omits the extras line when the pick has no extras', () => {
    expect(renderPrompt({ projectName: 'example', item: elementItem() })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Element: button.btn.primary — "Checkout" · button#checkout · role=button · data-testid=checkout',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
      ].join('\n'),
    );
  });

  it('renders only the extras parts that were captured', () => {
    const componentOnly = renderPrompt({
      projectName: 'example',
      item: elementItem([capture({}, { component: 'CheckoutButton' })]),
    });
    const stylesOnly = renderPrompt({
      projectName: 'example',
      item: elementItem([capture({}, { styles: { display: 'flex' } })]),
    });
    const ariaOnly = renderPrompt({
      projectName: 'example',
      item: elementItem([capture({}, { aria: { name: 'Checkout' } })]),
    });

    expect(componentOnly).toContain('  extras    component=CheckoutButton');
    expect(stylesOnly).toContain('  extras    display=flex');
    expect(ariaOnly).toContain('  extras    name=Checkout');
    expect(ariaOnly).not.toContain('extras    role=');
  });

  it('leaves the extras line out when only a screenshot was captured', () => {
    const rendered = renderPrompt({
      projectName: 'example',
      item: elementItem([
        capture({}, { screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 } }),
      ]),
    });

    expect(rendered).not.toContain('extras');
  });

  it('omits the attrs segment when the element has no key attributes', () => {
    const item = elementItem([capture({ classes: [], attributes: {} })]);

    const rendered = renderPrompt({ projectName: 'example', item });
    expect(rendered).toContain('Element: button — "Checkout" · button#checkout');
    expect(rendered).not.toContain('role=button');
  });

  it('renders a numbered element set with extras under their element', () => {
    const item = elementItem([
      capture({ tag: 'button', id: 'checkout', classes: ['btn'], selector: 'button#checkout', text: 'Checkout' }),
      capture(
        {
          tag: 'h1',
          id: null,
          classes: ['title'],
          selector: 'h1.title',
          text: 'Your cart',
          attributes: {},
        },
        { component: 'CartTitle', aria: { role: 'heading' } },
      ),
      capture({
        tag: 'p',
        id: null,
        classes: [],
        selector: 'p:nth-of-type(2)',
        text: 'Total',
        attributes: { 'data-testid': 'total' },
      }),
    ]);

    expect(renderPrompt({ projectName: 'example', item })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment: Checkout button is broken',
        '',
        'Elements (3):',
        '1. button.btn — "Checkout" · button#checkout · role=button · data-testid=checkout',
        '2. h1.title — "Your cart" · h1.title',
        '   extras    component=CartTitle · role=heading',
        '3. p — "Total" · p:nth-of-type(2) · data-testid=total',
        '',
        'Page: https://example.com/cart?step=2',
        '  title     Cart',
      ].join('\n'),
    );
  });

  it('renders two elements as a numbered set', () => {
    const item = elementItem([
      capture({ tag: 'button', classes: ['btn'], selector: 'button.btn' }),
      capture({ tag: 'h1', id: null, classes: [], selector: 'h1', attributes: {} }),
    ]);

    const rendered = renderPrompt({ projectName: 'example', item });

    expect(rendered).toContain('Elements (2):');
    expect(rendered).toContain('1. button.btn — "Checkout" · button.btn · role=button · data-testid=checkout');
    expect(rendered).toContain('2. h1 — "Checkout" · h1');
  });

  it('drops the box, viewport, scroll, and footer lines', () => {
    const rendered = renderPrompt({ projectName: 'example', item: elementItem() });

    expect(rendered).not.toContain('box');
    expect(rendered).not.toContain('viewport');
    expect(rendered).not.toContain('scroll');
    expect(rendered).not.toContain('Sent by Browsertalk');
    expect(rendered).not.toContain('2026-10-10T09:06:00.000Z');
  });

  it('renders a page-only item without an element block or comment text', () => {
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

    expect(renderPrompt({ projectName: 'example', item })).toBe(
      [
        '## Browser feedback — example',
        '',
        'Comment:',
        '',
        'Page: https://example.com/page?q=1',
        '  title     Page',
      ].join('\n'),
    );
  });

  it('keeps a multi-line comment intact', () => {
    const item = { ...elementItem(), comment: 'First line\nsecond line' };

    expect(renderPrompt({ projectName: 'example', item })).toContain('Comment: First line\nsecond line');
  });
});
