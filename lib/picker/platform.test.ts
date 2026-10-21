import { describe, expect, it } from 'vitest';
import { formatPickCount, modifierLabel } from './platform';

describe('platform modifier label', () => {
  it('uses the command glyph on macOS and iOS', () => {
    expect(modifierLabel('MacIntel', 'Mozilla/5.0')).toBe('⌘');
    expect(modifierLabel('iPhone', 'Mozilla/5.0')).toBe('⌘');
    expect(modifierLabel('Linux x86_64', 'Mozilla/5.0 (Mac OS X 10_15_7)')).toBe('⌘');
  });

  it('uses Ctrl everywhere else', () => {
    expect(modifierLabel('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toBe('Ctrl');
    expect(modifierLabel('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')).toBe('Ctrl');
  });
});

describe('pick count copy', () => {
  it('names the count and the release gesture', () => {
    expect(formatPickCount(3, '⌘')).toBe('3 selected · release ⌘ to comment');
    expect(formatPickCount(1, 'Ctrl')).toBe('1 selected · release Ctrl to comment');
  });
});
