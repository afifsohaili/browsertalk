import { describe, expect, it } from 'vitest';
import {
  assembleExtras,
  MAX_STYLE_PROPERTIES,
  pickStyleSubset,
  resolveAccessibleName,
  resolveAria,
  resolveAriaRole,
  type RawAriaCapture,
  type RawExtrasCapture,
} from './extras';

function ariaInput(partial: Partial<RawAriaCapture> & { tag: string }): RawAriaCapture {
  return {
    role: null,
    inputType: null,
    hasHref: false,
    multiple: false,
    ariaLabelledBy: null,
    ariaLabel: null,
    labelText: null,
    alt: null,
    title: null,
    text: '',
    ...partial,
  };
}

function extrasInput(partial: Partial<RawExtrasCapture>): RawExtrasCapture {
  return { component: null, styles: {}, aria: null, ...partial };
}

describe('computed styles subset', () => {
  it('returns null when nothing usable is present', () => {
    expect(pickStyleSubset({})).toBeNull();
    expect(pickStyleSubset({ display: '', cursor: '   ' })).toBeNull();
  });

  it('keeps only whitelisted properties in whitelist order', () => {
    const picked = pickStyleSubset({
      cursor: 'pointer',
      display: 'inline-block',
      unknown: 'ignored',
      color: 'rgb(0, 0, 0)',
    });

    expect(picked).toEqual({ display: 'inline-block', color: 'rgb(0, 0, 0)', cursor: 'pointer' });
  });

  it('caps the subset at the documented number of properties', () => {
    const picked = pickStyleSubset({
      display: 'block',
      position: 'relative',
      'z-index': '2',
      opacity: '0.5',
      color: 'red',
      'background-color': 'blue',
      'font-size': '16px',
      'font-weight': '700',
      'border-radius': '4px',
      overflow: 'hidden',
      cursor: 'pointer',
    });

    expect(Object.keys(picked ?? {})).toEqual([
      'display',
      'position',
      'z-index',
      'opacity',
      'color',
      'background-color',
      'font-size',
      'font-weight',
    ]);
    expect(Object.keys(picked ?? {})).toHaveLength(MAX_STYLE_PROPERTIES);
  });

  it('collapses whitespace and caps long values', () => {
    const picked = pickStyleSubset({ display: '  inline \n block ', cursor: 'x'.repeat(80) });

    expect(picked).toEqual({ display: 'inline block', cursor: `${'x'.repeat(60)}…` });
  });
});

describe('aria role resolution', () => {
  it('prefers the explicit role attribute', () => {
    expect(resolveAriaRole(ariaInput({ tag: 'div', role: '  button  ' }))).toBe('button');
    expect(resolveAriaRole(ariaInput({ tag: 'div', role: 'button gridcell' }))).toBe('button');
  });

  it('falls back to implicit roles', () => {
    expect(resolveAriaRole(ariaInput({ tag: 'button' }))).toBe('button');
    expect(resolveAriaRole(ariaInput({ tag: 'a', hasHref: true }))).toBe('link');
    expect(resolveAriaRole(ariaInput({ tag: 'textarea' }))).toBe('textbox');
    expect(resolveAriaRole(ariaInput({ tag: 'h2' }))).toBe('heading');
    expect(resolveAriaRole(ariaInput({ tag: 'nav' }))).toBe('navigation');
    expect(resolveAriaRole(ariaInput({ tag: 'img' }))).toBe('img');
  });

  it('resolves input roles from the type', () => {
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'text' }))).toBe('textbox');
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'checkbox' }))).toBe('checkbox');
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'search' }))).toBe('searchbox');
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'number' }))).toBe('spinbutton');
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'submit' }))).toBe('button');
    expect(resolveAriaRole(ariaInput({ tag: 'input', inputType: 'hidden' }))).toBeNull();
  });

  it('resolves select roles from multiple', () => {
    expect(resolveAriaRole(ariaInput({ tag: 'select' }))).toBe('combobox');
    expect(resolveAriaRole(ariaInput({ tag: 'select', multiple: true }))).toBe('listbox');
  });

  it('returns null when no role applies', () => {
    expect(resolveAriaRole(ariaInput({ tag: 'a' }))).toBeNull();
    expect(resolveAriaRole(ariaInput({ tag: 'div' }))).toBeNull();
    expect(resolveAriaRole(ariaInput({ tag: 'p' }))).toBeNull();
  });
});

describe('accessible name resolution', () => {
  it('walks the fallback chain in order', () => {
    const full = ariaInput({
      tag: 'button',
      ariaLabelledBy: 'Cart',
      ariaLabel: 'Checkout',
      labelText: 'Buy',
      title: 'Proceed',
      text: 'Go',
    });

    expect(resolveAccessibleName(full)).toBe('Cart');
    expect(resolveAccessibleName({ ...full, ariaLabelledBy: null })).toBe('Checkout');
    expect(resolveAccessibleName({ ...full, ariaLabelledBy: null, ariaLabel: null })).toBe('Buy');
    expect(resolveAccessibleName({ ...full, ariaLabelledBy: null, ariaLabel: null, labelText: null })).toBe('Proceed');
    expect(
      resolveAccessibleName({ ...full, ariaLabelledBy: null, ariaLabel: null, labelText: null, title: null }),
    ).toBe('Go');
  });

  it('uses alt for images before title and text', () => {
    expect(resolveAccessibleName(ariaInput({ tag: 'img', alt: 'Cart icon', title: 'x' }))).toBe('Cart icon');
  });

  it('falls back to text content for name-from-content elements', () => {
    expect(resolveAccessibleName(ariaInput({ tag: 'button', text: '  Checkout \n now  ' }))).toBe('Checkout now');
    expect(resolveAccessibleName(ariaInput({ tag: 'h2', text: 'Cart' }))).toBe('Cart');
  });

  it('skips text content for elements that do not name from content', () => {
    expect(resolveAccessibleName(ariaInput({ tag: 'input', text: 'not a name' }))).toBeNull();
    expect(resolveAccessibleName(ariaInput({ tag: 'img', text: 'alt text is separate' }))).toBeNull();
  });

  it('ignores blank candidates and caps long ones', () => {
    expect(resolveAccessibleName(ariaInput({ tag: 'button', ariaLabel: '   ', text: 'Go' }))).toBe('Go');
    expect(resolveAccessibleName(ariaInput({ tag: 'button', ariaLabel: 'x'.repeat(200) }))).toBe(
      `${'x'.repeat(120)}…`,
    );
  });

  it('returns null when nothing names the element', () => {
    expect(resolveAccessibleName(ariaInput({ tag: 'div' }))).toBeNull();
  });
});

describe('aria pair assembly', () => {
  it('omits missing members', () => {
    expect(resolveAria(ariaInput({ tag: 'button', text: 'Go' }))).toEqual({ role: 'button', name: 'Go' });
    expect(resolveAria(ariaInput({ tag: 'button' }))).toEqual({ role: 'button' });
    expect(resolveAria(ariaInput({ tag: 'div', ariaLabel: 'Hero' }))).toEqual({ name: 'Hero' });
  });

  it('returns null when neither role nor name resolves', () => {
    expect(resolveAria(ariaInput({ tag: 'div' }))).toBeNull();
  });
});

describe('extras assembly', () => {
  it('returns null without raw extras', () => {
    expect(assembleExtras(undefined)).toBeNull();
  });

  it('returns null when every piece is empty', () => {
    expect(assembleExtras(extrasInput({ component: '   ', styles: { display: '' } }))).toBeNull();
  });

  it('assembles component, styles, and aria together', () => {
    const extras = assembleExtras(
      extrasInput({
        component: '  CheckoutButton  ',
        styles: { display: 'block' },
        aria: ariaInput({ tag: 'button', text: 'Go' }),
      }),
    );

    expect(extras).toEqual({
      component: 'CheckoutButton',
      styles: { display: 'block' },
      aria: { role: 'button', name: 'Go' },
    });
  });

  it('caps the component name', () => {
    const extras = assembleExtras(extrasInput({ component: 'x'.repeat(100) }));

    expect(extras).toEqual({ component: `${'x'.repeat(60)}…` });
  });
});
