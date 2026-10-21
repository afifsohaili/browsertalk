export const MAX_SCREENSHOT_BYTES = 1_500_000;

/** Chrome allows two captures per window, so a five-element set cannot attach more than four. */
export const MAX_ELEMENT_ATTACHMENTS = 4;

export const MAX_SCREENSHOT_DATA_URL_CHARS = Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4 + 64;

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SCREENSHOT_DATA_URL_CHARS && IMAGE_DATA_URL.test(value);
}
