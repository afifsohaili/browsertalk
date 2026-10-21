export const MAX_PICKED_ELEMENTS = 5;

export type PickAction = 'add' | 'add-and-finish' | 'remove' | 'finish' | 'ignore';

export interface PickClick {
  modifier: boolean;
  selected: boolean;
  count: number;
  limit?: number;
}

export function pickAction(click: PickClick): PickAction {
  const limit = click.limit ?? MAX_PICKED_ELEMENTS;

  if (click.modifier) {
    if (click.selected) return 'remove';
    if (click.count >= limit) return 'ignore';
    return click.count + 1 >= limit ? 'add-and-finish' : 'add';
  }

  return click.count === 0 ? 'add-and-finish' : 'finish';
}

export type PickToggle = 'added' | 'removed' | 'full';

export interface PickSelection<T> {
  items: () => readonly T[];
  count: () => number;
  indexOf: (item: T) => number;
  has: (item: T) => boolean;
  add: (item: T) => number | null;
  toggle: (item: T) => PickToggle;
  isFull: () => boolean;
  clear: () => void;
}

export function createPickSelection<T>(limit = MAX_PICKED_ELEMENTS): PickSelection<T> {
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
