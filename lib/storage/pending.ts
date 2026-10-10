import { browser } from 'wxt/browser';
import { isPickerFeedback, type PickerFeedback } from '@/lib/picker/facts';
import { STORAGE_KEYS } from './keys';

export async function setPendingFeedback(feedback: PickerFeedback): Promise<void> {
  await browser.storage.session.set({ [STORAGE_KEYS.pending.feedback]: feedback });
}

export async function getPendingFeedback(): Promise<PickerFeedback | null> {
  const stored = await browser.storage.session.get(STORAGE_KEYS.pending.feedback);
  const value = stored[STORAGE_KEYS.pending.feedback];
  return isPickerFeedback(value) ? value : null;
}

export async function clearPendingFeedback(): Promise<void> {
  await browser.storage.session.remove(STORAGE_KEYS.pending.feedback);
}
