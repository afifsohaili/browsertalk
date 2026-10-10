import { describe, expect, it } from 'vitest';
import { isImageDataUrl, MAX_SCREENSHOT_DATA_URL_CHARS } from './limits';

describe('image data URL guard', () => {
  it('accepts a bounded base64 image', () => {
    expect(isImageDataUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isImageDataUrl('data:image/jpeg;base64,AA+/==')).toBe(true);
    expect(isImageDataUrl('data:image/webp;base64,AAAA')).toBe(true);
  });

  it('rejects a URL that is not a base64 image', () => {
    expect(isImageDataUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isImageDataUrl('data:image/png,AAAA')).toBe(false);
    expect(isImageDataUrl('data:image/png;base64,')).toBe(false);
    expect(isImageDataUrl('data:image/png;base64,not base64!!')).toBe(false);
    expect(isImageDataUrl('https://example.com/element.png')).toBe(false);
    expect(isImageDataUrl(42)).toBe(false);
    expect(isImageDataUrl(null)).toBe(false);
  });

  it('rejects a data URL longer than the budget', () => {
    const payload = 'A'.repeat(MAX_SCREENSHOT_DATA_URL_CHARS);

    expect(isImageDataUrl(`data:image/png;base64,${payload}`)).toBe(false);
  });
});
