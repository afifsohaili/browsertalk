import { browser } from 'wxt/browser';
import type { OutboxChangedEvent } from './protocol';

export function broadcastOutboxChanged(): void {
  const message: OutboxChangedEvent = { type: 'outbox/changed' };
  try {
    void browser.runtime.sendMessage(message).catch(() => {});
  } catch {
    /* no surface is open */
  }
}
