import { browser } from 'wxt/browser';
import { isPickerFeedback, type PickerFeedback } from '@/lib/picker/facts';
import { STORAGE_KEYS } from './keys';

const tails = new Map<number, Promise<unknown>>();

export function pendingFeedbackKey(tabId: number): string {
  return `${STORAGE_KEYS.pending.feedback}.${tabId}`;
}

export function setPendingFeedback(tabId: number, feedback: PickerFeedback): Promise<void> {
  return enqueuePendingMutation(tabId, async () => {
    await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: feedback });
  });
}

export async function getPendingFeedback(tabId: number): Promise<PickerFeedback | null> {
  const key = pendingFeedbackKey(tabId);
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  return isPickerFeedback(value) ? value : null;
}

export function clearPendingFeedback(tabId: number, captureID?: string): Promise<void> {
  return enqueuePendingMutation(tabId, async () => {
    if (captureID !== undefined) {
      const pending = await getPendingFeedback(tabId);
      if (pending === null || pending.id !== captureID) return;
    }
    await browser.storage.session.remove(pendingFeedbackKey(tabId));
  });
}

function enqueuePendingMutation<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  const previous = tails.get(tabId) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(tabId, tail);
  void tail.then(() => {
    if (tails.get(tabId) === tail) tails.delete(tabId);
  });
  return result;
}
