import { describe, expect, it } from 'vitest';
import { createPickState, MAX_PICKED_ELEMENTS, pickAction } from './pick-state';

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

describe('pick state', () => {
  it('starts empty', () => {
    const state = createPickState<{ name: string }>();

    expect(state.count()).toBe(0);
    expect(state.items()).toEqual([]);
    expect(state.isFull()).toBe(false);
  });

  it('adds elements in pick order and reports their position', () => {
    const state = createPickState<{ name: string }>();
    const first = element('first');
    const second = element('second');

    expect(state.add(first)).toBe(0);
    expect(state.add(second)).toBe(1);
    expect(state.items()).toEqual([first, second]);
    expect(state.indexOf(second)).toBe(1);
    expect(state.has(first)).toBe(true);
  });

  it('dedupes by node identity, not by shape', () => {
    const state = createPickState<{ name: string }>();
    const first = element('button');
    const lookalike = element('button');

    state.add(first);

    expect(state.add(lookalike)).toBe(1);
    expect(state.count()).toBe(2);
  });

  it('toggles a selected element off and reports the removal', () => {
    const state = createPickState<{ name: string }>();
    const first = element('first');
    const second = element('second');
    state.add(first);
    state.add(second);

    expect(state.toggle(first)).toBe('removed');
    expect(state.items()).toEqual([second]);
    expect(state.has(first)).toBe(false);
  });

  it('toggles a new element on and appends it', () => {
    const state = createPickState<{ name: string }>();
    const first = element('first');
    const second = element('second');

    expect(state.toggle(first)).toBe('added');
    expect(state.toggle(second)).toBe('added');
    expect(state.items()).toEqual([first, second]);
  });

  it('reports full instead of adding a sixth element', () => {
    const state = createPickState<{ name: string }>();

    for (let index = 0; index < MAX_PICKED_ELEMENTS; index += 1) {
      expect(state.add(element(`pick-${index}`))).toBe(index);
    }

    expect(state.isFull()).toBe(true);
    expect(state.add(element('pick-sixth'))).toBeNull();
    expect(state.toggle(element('pick-sixth'))).toBe('full');
    expect(state.count()).toBe(MAX_PICKED_ELEMENTS);
  });

  it('clears every element', () => {
    const state = createPickState<{ name: string }>();
    state.add(element('first'));
    state.add(element('second'));

    state.clear();

    expect(state.count()).toBe(0);
    expect(state.items()).toEqual([]);
    expect(state.isFull()).toBe(false);
  });
});
