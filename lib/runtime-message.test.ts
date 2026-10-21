import { afterEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { BACKGROUND_UNAVAILABLE, sendSafely } from './runtime-message';

const originalSendMessage = browser.runtime.sendMessage;

afterEach(() => {
  browser.runtime.sendMessage = originalSendMessage;
});

function stubSendMessage(implementation: () => Promise<unknown>): void {
  browser.runtime.sendMessage = vi.fn(implementation) as unknown as typeof browser.runtime.sendMessage;
}

describe('runtime messages', () => {
  it('passes the message through and returns the response', async () => {
    const sent = vi.fn(async () => ({ ok: true }));
    browser.runtime.sendMessage = sent as unknown as typeof browser.runtime.sendMessage;

    await expect(sendSafely({ type: 'picker/arm' })).resolves.toEqual({ ok: true });
    expect(sent).toHaveBeenCalledWith({ type: 'picker/arm' });
  });

  it('returns null when the background is not there', async () => {
    stubSendMessage(async () => {
      throw new Error('Receiving end does not exist');
    });

    await expect(sendSafely({ type: 'picker/arm' })).resolves.toBeNull();
  });

  it('names the shared fallback once', () => {
    expect(BACKGROUND_UNAVAILABLE).toBe('Background unavailable');
  });
});
