import { describe, expect, it } from 'vitest';
import {
  isPickerElementCapture,
  isPickerFeedback,
  type PickerElementCapture,
  type PickerElementFacts,
  type PickerExtras,
  type PickerFeedback,
} from './facts';
import { MAX_SCREENSHOT_DATA_URL_CHARS } from './limits';
import { isArmPickerResult, isCaptureResult, isElementIndex, isPickerMessage } from './protocol';

export function sampleExtras(): PickerExtras {
  return {
    screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: 120, height: 32 },
    component: 'CheckoutButton',
    styles: { display: 'inline-block', color: 'rgb(255, 255, 255)' },
    aria: { role: 'button', name: 'Checkout' },
  };
}

export function sampleElementFacts(overrides: Partial<PickerElementFacts> = {}): PickerElementFacts {
  return {
    tag: 'button',
    id: 'checkout',
    classes: ['btn', 'primary'],
    selector: 'button#checkout',
    text: 'Checkout',
    attributes: { role: 'button', 'data-testid': 'checkout' },
    box: { x: 10, y: 20, width: 120, height: 32 },
    viewport: { width: 1280, height: 800 },
    scroll: { x: 0, y: 0 },
    ...overrides,
  };
}

export function sampleElementCapture(overrides: Partial<PickerElementCapture> = {}): PickerElementCapture {
  return { element: sampleElementFacts(), ...overrides };
}

export function sampleFeedback(): PickerFeedback {
  return {
    id: 'fb_1',
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: {
      url: 'https://example.com/cart?step=2',
      path: '/cart',
      query: [{ name: 'step', value: '2' }],
      title: 'Cart',
    },
    elements: [sampleElementCapture()],
  };
}

describe('picker message guard', () => {
  it('accepts an arm request', () => {
    expect(isPickerMessage({ type: 'picker/arm' })).toBe(true);
  });

  it('accepts a captured feedback message', () => {
    expect(isPickerMessage({ type: 'picker/captured', feedback: sampleFeedback(), elementIndex: 0 })).toBe(true);
  });

  it('leaves other messages alone', () => {
    expect(isPickerMessage({ type: 'connection/status' })).toBe(false);
    expect(isPickerMessage('picker/arm')).toBe(false);
    expect(isPickerMessage(null)).toBe(false);
    expect(isPickerMessage({ type: 'picker/other' })).toBe(false);
  });
});

describe('element index guard', () => {
  it('accepts a whole index from zero', () => {
    expect(isElementIndex(0)).toBe(true);
    expect(isElementIndex(1)).toBe(true);
    expect(isElementIndex(4)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isElementIndex(-1)).toBe(false);
    expect(isElementIndex(1.5)).toBe(false);
    expect(isElementIndex(Number.NaN)).toBe(false);
    expect(isElementIndex(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isElementIndex('0')).toBe(false);
    expect(isElementIndex(undefined)).toBe(false);
    expect(isElementIndex(null)).toBe(false);
  });
});

describe('feedback validation', () => {
  it('accepts a complete feedback item', () => {
    expect(isPickerFeedback(sampleFeedback())).toBe(true);
  });

  it('accepts a null element id and empty collections', () => {
    const feedback = sampleFeedback();
    const element = feedback.elements[0]!.element;
    element.id = null;
    element.classes = [];
    element.attributes = {};
    feedback.page.query = [];

    expect(isPickerFeedback(feedback)).toBe(true);
  });

  it('accepts an ordered element set', () => {
    const feedback: PickerFeedback = {
      ...sampleFeedback(),
      elements: [
        sampleElementCapture(),
        sampleElementCapture({ element: sampleElementFacts({ tag: 'h1', id: null, selector: 'h1', text: 'Cart' }) }),
        sampleElementCapture({ element: sampleElementFacts({ tag: 'p', id: null, selector: 'p', text: 'Total' }) }),
      ],
    };

    expect(isPickerFeedback(feedback)).toBe(true);
  });

  it('rejects a missing element set', () => {
    const { elements: _elements, ...rest } = sampleFeedback();

    expect(isPickerFeedback(rest)).toBe(false);
  });

  it('rejects the old single-element shape', () => {
    const { elements, ...rest } = sampleFeedback();

    expect(isPickerFeedback({ ...rest, element: elements[0]!.element })).toBe(false);
    expect(isPickerFeedback({ ...rest, element: elements[0]!.element, extras: sampleExtras() })).toBe(false);
  });

  it('rejects an empty element set', () => {
    expect(isPickerFeedback({ ...sampleFeedback(), elements: [] })).toBe(false);
  });

  it('rejects a malformed element entry', () => {
    expect(isPickerFeedback({ ...sampleFeedback(), elements: [{ element: { tag: 'button' } }] })).toBe(false);
    expect(isPickerFeedback({ ...sampleFeedback(), elements: ['nope'] })).toBe(false);
    expect(isPickerFeedback({ ...sampleFeedback(), elements: [{ extras: { component: 'App' } }] })).toBe(false);
  });

  it('rejects non-string attribute values', () => {
    const feedback = sampleFeedback();
    feedback.elements[0]!.element.attributes = { role: 42 } as unknown as Record<string, string>;

    expect(isPickerFeedback(feedback)).toBe(false);
  });

  it('rejects malformed query params', () => {
    const feedback = sampleFeedback();
    feedback.page.query = [{ name: 'step' }] as unknown as PickerFeedback['page']['query'];

    expect(isPickerFeedback(feedback)).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    const feedback = sampleFeedback();
    feedback.elements[0]!.element.box.width = Number.POSITIVE_INFINITY;

    expect(isPickerFeedback(feedback)).toBe(false);
  });

  it('rejects missing identity fields', () => {
    const feedback = sampleFeedback();
    feedback.id = '';

    expect(isPickerFeedback(feedback)).toBe(true);
    expect(isPickerFeedback({ ...feedback, id: 7 })).toBe(false);
    expect(isPickerFeedback({ ...feedback, capturedAt: null })).toBe(false);
  });
});

describe('element capture validation', () => {
  it('accepts an entry with and without extras', () => {
    expect(isPickerElementCapture(sampleElementCapture())).toBe(true);
    expect(isPickerElementCapture(sampleElementCapture({ extras: sampleExtras() }))).toBe(true);
    expect(isPickerElementCapture(sampleElementCapture({ extras: {} }))).toBe(true);
  });

  it('rejects a missing or malformed element', () => {
    expect(isPickerElementCapture({ extras: {} })).toBe(false);
    expect(isPickerElementCapture({ element: { tag: 'button' } })).toBe(false);
    expect(isPickerElementCapture(null)).toBe(false);
  });

  it('rejects malformed extras', () => {
    expect(isPickerElementCapture(sampleElementCapture({ extras: { styles: { display: 42 } } as unknown as PickerExtras }))).toBe(false);
  });
});

describe('extras validation', () => {
  const withExtras = (extras: unknown): unknown => ({
    ...sampleFeedback(),
    elements: [{ element: sampleElementFacts(), extras }],
  });

  it('accepts a feedback with a full extras set', () => {
    expect(isPickerFeedback(withExtras(sampleExtras()))).toBe(true);
  });

  it('accepts partial extras', () => {
    expect(isPickerFeedback(withExtras({ component: 'App' }))).toBe(true);
    expect(isPickerFeedback(withExtras({ aria: { name: 'Checkout' } }))).toBe(true);
    expect(isPickerFeedback(withExtras({}))).toBe(true);
  });

  it('rejects a screenshot without a data URL and size', () => {
    const missingDataUrl = { screenshot: { width: 10, height: 10 } };
    const badWidth = { screenshot: { dataUrl: 'data:image/png;base64,AAAA', width: '10', height: 10 } };

    expect(isPickerFeedback(withExtras(missingDataUrl))).toBe(false);
    expect(isPickerFeedback(withExtras(badWidth))).toBe(false);
  });

  it('rejects a data URL that is not a bounded base64 image', () => {
    const extrasWith = (dataUrl: string) => ({ screenshot: { dataUrl, width: 10, height: 10 } });
    const overBudget = `data:image/png;base64,${'A'.repeat(MAX_SCREENSHOT_DATA_URL_CHARS + 1)}`;

    expect(isPickerFeedback(withExtras(extrasWith('data:text/plain;base64,AAAA')))).toBe(false);
    expect(isPickerFeedback(withExtras(extrasWith('data:image/png,AAAA')))).toBe(false);
    expect(isPickerFeedback(withExtras(extrasWith(overBudget)))).toBe(false);
  });

  it('rejects non-string style values', () => {
    expect(isPickerFeedback(withExtras({ styles: { display: 42 } }))).toBe(false);
  });

  it('rejects a component that is not a string', () => {
    expect(isPickerFeedback(withExtras({ component: 42 }))).toBe(false);
  });

  it('rejects an aria pair with non-string members', () => {
    expect(isPickerFeedback(withExtras({ aria: { role: 1 } }))).toBe(false);
    expect(isPickerFeedback(withExtras({ aria: { name: 1 } }))).toBe(false);
  });

  it('rejects extras that are not an object', () => {
    expect(isPickerFeedback(withExtras('nope'))).toBe(false);
    expect(isPickerFeedback(withExtras(7))).toBe(false);
  });
});

describe('arm result guard', () => {
  it('accepts both result shapes', () => {
    expect(isArmPickerResult({ ok: true, armed: true })).toBe(true);
    expect(isArmPickerResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed results', () => {
    expect(isArmPickerResult({ ok: true })).toBe(false);
    expect(isArmPickerResult({ ok: true, armed: 'yes' })).toBe(false);
    expect(isArmPickerResult({ ok: false })).toBe(false);
    expect(isArmPickerResult(null)).toBe(false);
  });
});

describe('capture result guard', () => {
  it('accepts both result shapes', () => {
    expect(isCaptureResult({ ok: true })).toBe(true);
    expect(isCaptureResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed results', () => {
    expect(isCaptureResult({ ok: false })).toBe(false);
    expect(isCaptureResult({ ok: 'yes' })).toBe(false);
    expect(isCaptureResult(undefined)).toBe(false);
  });
});
