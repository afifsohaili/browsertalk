export const MAX_PICKED_ELEMENTS = 5;

export type PickAction = 'add' | 'add-and-finish' | 'remove' | 'finish' | 'ignore';

export interface PickClick {
  modifier: boolean;
  selected: boolean;
  count: number;
}

export function pickAction(click: PickClick): PickAction {
  if (click.modifier) {
    if (click.selected) return 'remove';
    if (click.count >= MAX_PICKED_ELEMENTS) return 'ignore';
    return click.count + 1 >= MAX_PICKED_ELEMENTS ? 'add-and-finish' : 'add';
  }

  return click.count === 0 ? 'add-and-finish' : 'finish';
}

export type PickToggle = 'added' | 'removed' | 'full';

export interface PickState<T> {
  items: () => readonly T[];
  count: () => number;
  indexOf: (item: T) => number;
  has: (item: T) => boolean;
  add: (item: T) => number | null;
  toggle: (item: T) => PickToggle;
  isFull: () => boolean;
  clear: () => void;
}

export function createPickState<T>(limit = MAX_PICKED_ELEMENTS): PickState<T> {
  let items: T[] = [];

  function indexOf(item: T): number {
    return items.indexOf(item);
  }

  function add(item: T): number | null {
    const existing = indexOf(item);
    if (existing >= 0) return existing;
    if (items.length >= limit) return null;
    items.push(item);
    return items.length - 1;
  }

  return {
    items: () => items,
    count: () => items.length,
    indexOf,
    has: (item) => indexOf(item) >= 0,
    add,
    toggle: (item) => {
      const existing = indexOf(item);
      if (existing >= 0) {
        items = [...items.slice(0, existing), ...items.slice(existing + 1)];
        return 'removed';
      }
      return add(item) === null ? 'full' : 'added';
    },
    isFull: () => items.length >= limit,
    clear: () => {
      items = [];
    },
  };
}
