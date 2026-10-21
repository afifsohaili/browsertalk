import { describe, expect, it } from 'vitest';
import { formatPickCount } from './pill-copy';

describe('pick count copy', () => {
  it('names the count and the release gesture', () => {
    expect(formatPickCount(3, '⌘')).toBe('3 selected · release ⌘ to comment');
    expect(formatPickCount(1, 'Ctrl')).toBe('1 selected · release Ctrl to comment');
  });
});
