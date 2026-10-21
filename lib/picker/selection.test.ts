import { describe, expect, it } from 'vitest';
import { createPickSelection, MAX_PICKED_ELEMENTS, pickAction } from './selection';

function element(name: string): { name: string } {
  return { name };
}

describe('pick action', () => {
  it('adds on a modifier click while the set has room', () => {
    expect(pickAction({ modifier: true, selected: false, count: 0 })).toBe('add');
    expect(pickAction({ modifier: true, selected: false, count: 3 })).toBe('add');
  });

  it('adds the fifth element and finishes immediately', () => {
    expect(pickAction({ modifier: true, selected: false, count: MAX_PICKED_ELEMENTS - 1 })).toBe('add-and-finish');
  });

  it('toggles a selected element off even at the cap', () => {
    expect(pickAction({ modifier: true, selected: true, count: 1 })).toBe('remove');
    expect(pickAction({ modifier: true, selected: true, count: MAX_PICKED_ELEMENTS })).toBe('remove');
  });

  it('ignores a modifier add at the cap', () => {
    expect(pickAction({ modifier: true, selected: false, count: MAX_PICKED_ELEMENTS })).toBe('ignore');
  });

  it('adds and finishes on a plain click with an empty set', () => {
    expect(pickAction({ modifier: false, selected: false, count: 0 })).toBe('add-and-finish');
  });

  it('finishes without adding on a plain click with a set', () => {
    expect(pickAction({ modifier: false, selected: false, count: 2 })).toBe('finish');
    expect(pickAction({ modifier: false, selected: true, count: 2 })).toBe('finish');
  });
});

describe('pick selection', () => {
  it('starts empty', () => {
    const selection = createPickSelection<{ name: string }>();

    expect(selection.count()).toBe(0);
    expect(selection.items()).toEqual([]);
    expect(selection.isFull()).toBe(false);
  });

  it('adds elements in pick order and reports their position', () => {
    const selection = createPickSelection<{ name: string }>();
    const first = element('first');
    const second = element('second');

    expect(selection.add(first)).toBe(0);
    expect(selection.add(second)).toBe(1);
    expect(selection.items()).toEqual([first, second]);
    expect(selection.indexOf(second)).toBe(1);
    expect(selection.has(first)).toBe(true);
  });

  it('dedupes by node identity, not by shape', () => {
    const selection = createPickSelection<{ name: string }>();
    const first = element('button');
    const lookalike = element('button');

    selection.add(first);

    expect(selection.add(lookalike)).toBe(1);
    expect(selection.count()).toBe(2);
  });

  it('toggles a selected element off and reports the removal', () => {
    const selection = createPickSelection<{ name: string }>();
    const first = element('first');
    const second = element('second');
    selection.add(first);
    selection.add(second);

    expect(selection.toggle(first)).toBe('removed');
    expect(selection.items()).toEqual([second]);
    expect(selection.has(first)).toBe(false);
  });

  it('toggles a new element on and appends it', () => {
    const selection = createPickSelection<{ name: string }>();
    const first = element('first');
    const second = element('second');

    expect(selection.toggle(first)).toBe('added');
    expect(selection.toggle(second)).toBe('added');
    expect(selection.items()).toEqual([first, second]);
  });

  it('reports full instead of adding a sixth element', () => {
    const selection = createPickSelection<{ name: string }>();

    for (let index = 0; index < MAX_PICKED_ELEMENTS; index += 1) {
      expect(selection.add(element(`pick-${index}`))).toBe(index);
    }

    expect(selection.isFull()).toBe(true);
    expect(selection.add(element('pick-sixth'))).toBeNull();
    expect(selection.toggle(element('pick-sixth'))).toBe('full');
    expect(selection.count()).toBe(MAX_PICKED_ELEMENTS);
  });

  it('clears every element', () => {
    const selection = createPickSelection<{ name: string }>();
    selection.add(element('first'));
    selection.add(element('second'));

    selection.clear();

    expect(selection.count()).toBe(0);
    expect(selection.items()).toEqual([]);
    expect(selection.isFull()).toBe(false);
  });
});
