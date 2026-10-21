import { describe, expect, it } from 'vitest';
import type { PickerElementFacts } from '@/lib/picker/facts';
import { formatChipLabel, formatCountLabel, removeChip } from './chips';

function facts(overrides: Partial<PickerElementFacts> = {}): PickerElementFacts {
  return {
    tag: 'button',
    id: 'checkout',
    classes: ['btn', 'primary'],
    selector: 'button#checkout',
    text: 'Checkout',
    attributes: {},
    box: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1280, height: 800 },
    scroll: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('formatChipLabel', () => {
  it('names the element by tag and id, then its text', () => {
    expect(formatChipLabel(facts({ classes: [] }))).toBe('button#checkout · "Checkout"');
  });

  it('falls back to up to three classes when the element has no id', () => {
    expect(formatChipLabel(facts({ tag: 'div', id: null, classes: ['card', 'promo', 'wide', 'extra'] }))).toBe(
      'div.card.promo.wide · "Checkout"',
    );
  });

  it('omits the text segment when the element has no text', () => {
    expect(formatChipLabel(facts({ tag: 'input', id: 'email', classes: [], text: '' }))).toBe('input#email');
  });

  it('collapses whitespace in the text', () => {
    expect(formatChipLabel(facts({ text: '  Save\t 20%\n today ' }))).toBe(
      'button#checkout.btn.primary · "Save 20% today"',
    );
  });

  it('caps long text at 40 characters', () => {
    const text = 'x'.repeat(60);

    expect(formatChipLabel(facts({ text }))).toBe(`button#checkout.btn.primary · "${'x'.repeat(40)}…"`);
  });

  it('reads only the captured facts, not the live page', () => {
    expect(formatChipLabel(facts({ tag: 'a', id: null, classes: [], text: 'Docs', selector: 'nav > a' }))).toBe(
      'a · "Docs"',
    );
  });
});

describe('formatCountLabel', () => {
  it('names one element and many', () => {
    expect(formatCountLabel(0)).toBe('0 elements');
    expect(formatCountLabel(1)).toBe('1 element');
    expect(formatCountLabel(3)).toBe('3 elements');
  });
});

describe('removeChip', () => {
  it('drops the only chip and leaves an empty set', () => {
    expect(removeChip(['button#checkout'], 0)).toEqual([]);
  });

  it('drops one chip and keeps the rest in order', () => {
    expect(removeChip(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('leaves the set alone for an index out of range', () => {
    expect(removeChip(['a'], 3)).toEqual(['a']);
    expect(removeChip(['a'], -1)).toEqual(['a']);
    expect(removeChip([], 0)).toEqual([]);
  });

  it('does not change the input', () => {
    const entries = ['a', 'b'];

    removeChip(entries, 0);

    expect(entries).toEqual(['a', 'b']);
  });
});
