import { describe, expect, it } from 'vitest';
import { modifierLabel } from './platform';

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
