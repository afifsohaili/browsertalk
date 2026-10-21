import { describe, expect, it } from 'vitest';
import { formatElementCount } from './element-count';

describe('formatElementCount', () => {
  it('names a single element', () => {
    expect(formatElementCount(1)).toBe('1 element');
  });

  it('names a multi-element set', () => {
    expect(formatElementCount(3)).toBe('3 elements');
    expect(formatElementCount(5)).toBe('5 elements');
  });

  it('shows no count for a page-only send', () => {
    expect(formatElementCount(0)).toBe('');
    expect(formatElementCount(-1)).toBe('');
  });

  it('shows no count when the record predates element counts', () => {
    expect(formatElementCount(undefined)).toBe('');
  });
});
