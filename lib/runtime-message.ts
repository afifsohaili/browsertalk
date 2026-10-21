import { browser } from 'wxt/browser';

export const BACKGROUND_UNAVAILABLE = 'Background unavailable';

export async function sendSafely(message: unknown): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}
