import { describe, expect, it } from 'vitest';
import {
  assembleFeedback,
  buildSelectorPath,
  formatElementLabel,
  parsePageFacts,
  pickAttributes,
  toBoxFacts,
  toPointFacts,
  toSizeFacts,
  trimText,
  type ElementPathSegment,
  type RawCapture,
} from './collect';

function segment(partial: Partial<ElementPathSegment> & { tag: string }): ElementPathSegment {
  return { id: null, classes: [], index: 1, siblingCount: 1, ...partial };
}

describe('selector path', () => {
  it('is empty for an empty chain', () => {
    expect(buildSelectorPath([])).toBe('');
  });

  it('anchors on the element id when present', () => {
    expect(
      buildSelectorPath([
        segment({ tag: 'body' }),
        segment({ tag: 'button', id: 'submit', classes: ['btn', 'primary'] }),
      ]),
    ).toBe('button#submit');
  });

  it('anchors on the closest ancestor id', () => {
    const chain = [
      segment({ tag: 'body' }),
      segment({ tag: 'section', id: 'cart' }),
      segment({ tag: 'div' }),
      segment({ tag: 'button' }),
    ];

    expect(buildSelectorPath(chain)).toBe('section#cart > div > button');
  });

  it('walks the ancestor chain with nth-of-type for duplicated tags', () => {
    const chain = [
      segment({ tag: 'body' }),
      segment({ tag: 'div', index: 2, siblingCount: 3 }),
      segment({ tag: 'button', index: 1, siblingCount: 2 }),
    ];

    expect(buildSelectorPath(chain)).toBe('body > div:nth-of-type(2) > button:nth-of-type(1)');
  });

  it('includes classes and drops unusable ones', () => {
    const chain = [
      segment({ tag: 'body' }),
      segment({ tag: 'main', classes: ['hero'] }),
      segment({ tag: 'button', classes: ['btn', 'w-[213px]', 'md:flex'] }),
    ];

    expect(buildSelectorPath(chain)).toBe('body > main.hero > button.btn');
  });

  it('prefers the anchor closest to the element', () => {
    const chain = [
      segment({ tag: 'body', id: 'b' }),
      segment({ tag: 'section', id: 's' }),
      segment({ tag: 'div' }),
      segment({ tag: 'button' }),
    ];

    expect(buildSelectorPath(chain)).toBe('section#s > div > button');
  });
});

describe('text trimming', () => {
  it('collapses whitespace and trims', () => {
    expect(trimText('  hello \n\t world ')).toBe('hello world');
  });

  it('caps long text with an ellipsis', () => {
    const text = 'a'.repeat(200);

    expect(trimText(text)).toBe(`${'a'.repeat(160)}…`);
  });

  it('keeps text at the cap untouched', () => {
    const text = 'b'.repeat(160);

    expect(trimText(text)).toBe(text);
  });

  it('turns empty text into an empty string', () => {
    expect(trimText('   \n ')).toBe('');
  });
});

describe('attribute filtering', () => {
  it('keeps only the key attributes with values', () => {
    const attributes = {
      href: '/cart',
      src: '',
      role: 'button',
      'aria-label': 'Checkout',
      'data-testid': 'checkout',
      placeholder: 'Search',
      title: 'ignored',
      class: 'btn',
    };

    expect(pickAttributes(attributes)).toEqual({
      href: '/cart',
      role: 'button',
      'aria-label': 'Checkout',
      'data-testid': 'checkout',
      placeholder: 'Search',
    });
  });

  it('returns nothing when no key attributes are present', () => {
    expect(pickAttributes({ title: 'x' })).toEqual({});
  });
});

describe('element label', () => {
  it('shows the tag with up to three classes', () => {
    expect(formatElementLabel('BUTTON', null, ['btn', 'primary', 'lg', 'extra'])).toBe('button.btn.primary.lg');
  });

  it('shows the id when present', () => {
    expect(formatElementLabel('input', 'search', [])).toBe('input#search');
  });
});

describe('page facts', () => {
  it('parses url, path, query params, and title', () => {
    const facts = parsePageFacts('https://example.com/checkout?step=2&plan=pro&plan=team', '  Checkout  ');

    expect(facts).toEqual({
      url: 'https://example.com/checkout?step=2&plan=pro&plan=team',
      path: '/checkout',
      query: [
        { name: 'step', value: '2' },
        { name: 'plan', value: 'pro' },
        { name: 'plan', value: 'team' },
      ],
      title: 'Checkout',
    });
  });

  it('keeps an unparsable url with empty path and query', () => {
    expect(parsePageFacts('not a url', 'Title')).toEqual({
      url: 'not a url',
      path: '',
      query: [],
      title: 'Title',
    });
  });
});

describe('rounded geometry', () => {
  it('rounds the box', () => {
    expect(toBoxFacts({ x: 1.4, y: 2.6, width: 10.5, height: 4.4 })).toEqual({
      x: 1,
      y: 3,
      width: 11,
      height: 4,
    });
  });

  it('rounds the viewport', () => {
    expect(toSizeFacts({ width: 1280.7, height: 800.2 })).toEqual({ width: 1281, height: 800 });
  });

  it('rounds the scroll offset', () => {
    expect(toPointFacts({ x: 0.5, y: 120.4 })).toEqual({ x: 1, y: 120 });
  });
});

describe('fact assembly', () => {
  const raw: RawCapture = {
    page: {
      url: 'https://example.com/cart?step=2',
      title: '  Cart  ',
    },
    element: {
      tag: 'BUTTON',
      id: 'checkout',
      classes: ['btn', 'primary'],
      chain: [segment({ tag: 'body' }), segment({ tag: 'button', id: 'checkout', classes: ['btn', 'primary'] })],
      text: '  Checkout \n now ',
      attributes: { 'data-testid': 'checkout', title: 'ignored' },
      box: { x: 10.4, y: 20.6, width: 120.5, height: 32.4 },
      viewport: { width: 1280.2, height: 800.3 },
      scroll: { x: 0.4, y: 12.5 },
    },
  };

  it('assembles one feedback item from raw capture data', () => {
    const feedback = assembleFeedback(raw, { id: 'fb_1', capturedAt: '2026-10-10T09:00:00.000Z' });

    expect(feedback).toEqual({
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
            text: 'Checkout now',
            attributes: { 'data-testid': 'checkout' },
            box: { x: 10, y: 21, width: 121, height: 32 },
            viewport: { width: 1280, height: 800 },
            scroll: { x: 0, y: 13 },
          },
        },
      ],
    });
  });

  it('attaches extras when present', () => {
    const withExtras: RawCapture = {
      ...raw,
      extras: {
        component: 'CheckoutButton',
        styles: { cursor: 'pointer', display: 'inline-block' },
        aria: {
          tag: 'button',
          role: null,
          inputType: null,
          hasHref: false,
          multiple: false,
          ariaLabelledBy: null,
          ariaLabel: 'Checkout',
          labelText: null,
          alt: null,
          title: null,
          text: 'Checkout now',
        },
      },
    };

    const feedback = assembleFeedback(withExtras, { id: 'fb_1', capturedAt: '2026-10-10T09:00:00.000Z' });

    expect(feedback.elements[0]?.extras).toEqual({
      component: 'CheckoutButton',
      styles: { display: 'inline-block', cursor: 'pointer' },
      aria: { role: 'button', name: 'Checkout' },
    });
  });

  it('omits extras when there is nothing to attach', () => {
    const feedback = assembleFeedback(
      { ...raw, extras: { component: null, styles: {}, aria: null } },
      { id: 'fb_1', capturedAt: '2026-10-10T09:00:00.000Z' },
    );

    expect('extras' in feedback.elements[0]!).toBe(false);
  });
});
