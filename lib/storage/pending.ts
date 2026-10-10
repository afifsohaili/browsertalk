import { browser } from 'wxt/browser';
import { isPickerFeedback, type PickerFeedback } from '@/lib/picker/facts';
import { STORAGE_KEYS } from './keys';

export function pendingFeedbackKey(tabId: number): string {
  return `${STORAGE_KEYS.pending.feedback}.${tabId}`;
}

export async function setPendingFeedback(tabId: number, feedback: PickerFeedback): Promise<void> {
  await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: feedback });
}

export async function getPendingFeedback(tabId: number): Promise<PickerFeedback | null> {
  const key = pendingFeedbackKey(tabId);
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  return isPickerFeedback(value) ? value : null;
}

export async function clearPendingFeedback(tabId: number, captureID?: string): Promise<void> {
  if (captureID !== undefined) {
    const pending = await getPendingFeedback(tabId);
    if (pending === null || pending.id !== captureID) return;
  }
  await browser.storage.session.remove(pendingFeedbackKey(tabId));
}
