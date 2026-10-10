import { describe, expect, it } from 'vitest';
import { detectComponentName, MAX_COMPONENT_DEPTH } from './component';

type Fiber = Record<string, unknown>;

function reactElement(fiber: Fiber): Record<string, unknown> {
  return { '__reactFiber$k1a2b3': fiber };
}

function fiber(type: unknown, parent: Fiber | null): Fiber {
  return { tag: typeof type === 'string' ? 5 : 0, type, elementType: type, return: parent };
}

function chainOfTypes(types: unknown[]): Fiber {
  return types.reduceRight<Fiber | null>((parent, type) => fiber(type, parent), null) ?? { type: null, return: null };
}

describe('component detection', () => {
  it('returns null without dev markers', () => {
    expect(detectComponentName({ id: 'go' })).toBeNull();
  });

  it('names a React function component from the fiber return chain', () => {
    function CheckoutButton() {
      return null;
    }

    const element = reactElement(fiber('button', fiber(CheckoutButton, null)));

    expect(detectComponentName(element)).toBe('CheckoutButton');
  });

  it('picks the closest named component', () => {
    function Page() {
      return null;
    }
    function CartButton() {
      return null;
    }

    const element = reactElement(fiber('button', fiber(CartButton, fiber(Page, null))));

    expect(detectComponentName(element)).toBe('CartButton');
  });

  it('reads a React memo inner component', () => {
    function CartDrawer() {
      return null;
    }

    const element = reactElement(fiber({ $$typeof: Symbol.for('react.memo'), type: CartDrawer }, null));

    expect(detectComponentName(element)).toBe('CartDrawer');
  });

  it('reads a React forwardRef render function', () => {
    function CartIcon() {
      return null;
    }

    const element = reactElement(fiber({ $$typeof: Symbol.for('react.forwardRef'), render: CartIcon }, null));

    expect(detectComponentName(element)).toBe('CartIcon');
  });

  it('prefers an explicit displayName', () => {
    const element = reactElement(fiber({ displayName: 'ShoppingCart' }, null));

    expect(detectComponentName(element)).toBe('ShoppingCart');
  });

  it('skips anonymous components and keeps walking', () => {
    function App() {
      return null;
    }

    const element = reactElement(fiber(() => null, fiber(App, null)));

    expect(detectComponentName(element)).toBe('App');
  });

  it('returns null for a host-only React chain', () => {
    const element = reactElement(fiber('div', fiber('button', null)));

    expect(detectComponentName(element)).toBeNull();
  });

  it('stops walking past the depth cap', () => {
    function DeepComponent() {
      return null;
    }
    const element = reactElement(chainOfTypes([...Array(MAX_COMPONENT_DEPTH).fill('div'), DeepComponent]));

    expect(detectComponentName(element)).toBeNull();
  });

  it('names a Vue 3 component', () => {
    const element = { __vueParentComponent: { type: { name: 'CartDrawer' }, parent: null } };

    expect(detectComponentName(element)).toBe('CartDrawer');
  });

  it('falls back to the Vue __name marker', () => {
    const element = { __vueParentComponent: { type: { __name: 'cart-drawer' }, parent: null } };

    expect(detectComponentName(element)).toBe('cart-drawer');
  });

  it('walks the Vue parent chain', () => {
    const element = { __vueParentComponent: { type: {}, parent: { type: { name: 'App' }, parent: null } } };

    expect(detectComponentName(element)).toBe('App');
  });

  it('trims names and ignores blank ones', () => {
    const spaced = { __vueParentComponent: { type: { name: '  CartDrawer  ' }, parent: null } };
    const blank = { __vueParentComponent: { type: { name: '   ', __name: 'Fallback' }, parent: null } };

    expect(detectComponentName(spaced)).toBe('CartDrawer');
    expect(detectComponentName(blank)).toBe('Fallback');
  });

  it('survives junk marker values', () => {
    expect(detectComponentName({ '__reactFiber$k1': null })).toBeNull();
    expect(detectComponentName({ __vueParentComponent: 'nope' })).toBeNull();
  });
});
