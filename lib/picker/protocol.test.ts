import { describe, expect, it } from 'vitest';
import { isPickerFeedback, type PickerFeedback } from './facts';
import { isArmPickerResult, isCaptureResult, isPickerMessage } from './protocol';

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
    element: {
      tag: 'button',
      id: 'checkout',
      classes: ['btn', 'primary'],
      selector: 'button#checkout',
      text: 'Checkout',
      attributes: { role: 'button', 'data-testid': 'checkout' },
      box: { x: 10, y: 20, width: 120, height: 32 },
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0 },
    },
  };
}

describe('picker message guard', () => {
  it('accepts an arm request', () => {
    expect(isPickerMessage({ type: 'picker/arm' })).toBe(true);
  });

  it('accepts a captured feedback message', () => {
    expect(isPickerMessage({ type: 'picker/captured', feedback: sampleFeedback() })).toBe(true);
  });

  it('leaves other messages alone', () => {
    expect(isPickerMessage({ type: 'connection/status' })).toBe(false);
    expect(isPickerMessage('picker/arm')).toBe(false);
    expect(isPickerMessage(null)).toBe(false);
    expect(isPickerMessage({ type: 'picker/other' })).toBe(false);
  });
});

describe('feedback validation', () => {
  it('accepts a complete feedback item', () => {
    expect(isPickerFeedback(sampleFeedback())).toBe(true);
  });

  it('accepts a null element id and empty collections', () => {
    const feedback = sampleFeedback();
    feedback.element.id = null;
    feedback.element.classes = [];
    feedback.element.attributes = {};
    feedback.page.query = [];

    expect(isPickerFeedback(feedback)).toBe(true);
  });

  it('rejects a missing element', () => {
    const { element: _element, ...rest } = sampleFeedback();

    expect(isPickerFeedback(rest)).toBe(false);
  });

  it('rejects non-string attribute values', () => {
    const feedback = sampleFeedback();
    feedback.element.attributes = { role: 42 } as unknown as Record<string, string>;

    expect(isPickerFeedback(feedback)).toBe(false);
  });

  it('rejects malformed query params', () => {
    const feedback = sampleFeedback();
    feedback.page.query = [{ name: 'step' }] as unknown as PickerFeedback['page']['query'];

    expect(isPickerFeedback(feedback)).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    const feedback = sampleFeedback();
    feedback.element.box.width = Number.POSITIVE_INFINITY;

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
