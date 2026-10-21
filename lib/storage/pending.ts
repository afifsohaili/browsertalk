import { browser } from 'wxt/browser';
import { isPickerFeedback, type PickerFeedback } from '@/lib/picker/facts';
import { isQuotaExceeded } from './budgets';
import { STORAGE_KEYS } from './keys';

const tails = new Map<number, Promise<unknown>>();

export function pendingFeedbackKey(tabId: number): string {
  return `${STORAGE_KEYS.pending.feedback}.${tabId}`;
}

export function setPendingFeedback(
  tabId: number,
  feedback: PickerFeedback,
  fallback?: PickerFeedback,
): Promise<void> {
  return enqueuePendingMutation(tabId, async () => {
    try {
      await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: feedback });
    } catch (error) {
      if (fallback === undefined || !isQuotaExceeded(error)) throw error;
      await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: fallback });
    }
  });
}

export function mergePendingElement(
  tabId: number,
  feedback: PickerFeedback,
  index: number,
  fallback?: PickerFeedback,
): Promise<void> {
  return enqueuePendingMutation(tabId, async () => {
    const current = await getPendingFeedback(tabId);
    const merged = mergeElements(current, feedback, index);
    if (merged === null) return;

    try {
      await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: merged });
    } catch (error) {
      if (fallback === undefined || !isQuotaExceeded(error)) throw error;
      const latest = await getPendingFeedback(tabId);
      if (latest !== null && latest.id !== feedback.id) return;
      const retry = mergeElements(latest, fallback, index);
      if (retry === null) return;
      await browser.storage.session.set({ [pendingFeedbackKey(tabId)]: retry });
    }
  });
}

function mergeElements(
  pending: PickerFeedback | null,
  feedback: PickerFeedback,
  index: number,
): PickerFeedback | null {
  if (feedback.elements.length === 0) return pending;

  const set = pending !== null && pending.id === feedback.id ? pending : null;
  if (set === null) return { ...feedback, elements: [...feedback.elements] };

  const entries = [...set.elements];
  const at = Math.min(Math.max(index, 0), entries.length);
  const merged = [...entries.slice(0, at), ...feedback.elements, ...entries.slice(at + 1)];
  return { ...set, elements: merged };
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
