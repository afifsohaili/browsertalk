import { browser } from 'wxt/browser';
import { createPerTabQueue } from '@/lib/per-tab-queue';
import { isPickerFeedback, type PickerFeedback } from '@/lib/picker/facts';
import { isQuotaExceeded } from './budgets';
import { STORAGE_KEYS } from './keys';

const captures = createPerTabQueue({ continueOnError: true });
const mutations = createPerTabQueue({ continueOnError: true });

export function pendingFeedbackKey(tabId: number): string {
  return `${STORAGE_KEYS.pending.feedback}.${tabId}`;
}

export function queuePendingCapture<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  return captures.enqueue(tabId, operation);
}

function afterPendingCaptures<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  return captures.settled(tabId).then(operation);
}

export function setPendingFeedback(
  tabId: number,
  feedback: PickerFeedback,
  fallback?: PickerFeedback,
): Promise<void> {
  return mutations.enqueue(tabId, async () => {
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
  return mutations.enqueue(tabId, async () => {
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
  const incoming = feedback.elements.map((entry, offset) => ({ ...entry, index: index + offset }));
  const incomingIndices = new Set(incoming.map((entry) => entry.index));

  const kept = (set?.elements ?? [])
    .map((entry, position) => ({ entry, key: entry.index ?? position }))
    .filter((item) => !incomingIndices.has(item.key));
  const merged = [...kept, ...incoming.map((entry) => ({ entry, key: entry.index }))]
    .sort((left, right) => left.key - right.key)
    .map((item) => item.entry);

  const base = set ?? { ...feedback, elements: [] };
  return { ...base, elements: merged };
}

export function removePendingElement(tabId: number, setID: string, index: number): Promise<number | null> {
  return afterPendingCaptures(tabId, () =>
    mutations.enqueue(tabId, async () => {
      const pending = await getPendingFeedback(tabId);
      if (pending === null || pending.id !== setID) return null;

      const remaining = pending.elements.filter((entry, position) => (entry.index ?? position) !== index);
      if (remaining.length === pending.elements.length) return remaining.length;

      const key = pendingFeedbackKey(tabId);
      if (remaining.length === 0) {
        await browser.storage.session.remove(key);
        return 0;
      }

      await browser.storage.session.set({ [key]: { ...pending, elements: remaining } });
      return remaining.length;
    }),
  );
}

export async function getPendingFeedback(tabId: number): Promise<PickerFeedback | null> {
  const key = pendingFeedbackKey(tabId);
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  return isPickerFeedback(value) ? value : null;
}

export function clearPendingFeedback(tabId: number, captureID?: string): Promise<void> {
  return afterPendingCaptures(tabId, () =>
    mutations.enqueue(tabId, async () => {
      if (captureID !== undefined) {
        const pending = await getPendingFeedback(tabId);
        if (pending === null || pending.id !== captureID) return;
      }
      await browser.storage.session.remove(pendingFeedbackKey(tabId));
    }),
  );
}
