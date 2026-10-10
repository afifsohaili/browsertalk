import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export interface StoredSession {
  sessionID: string;
  title: string;
}

export async function getStoredSession(
  backendId: string,
  strategyId: string,
  key: string,
): Promise<StoredSession | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.sessions);
  return readSession(stored[STORAGE_KEYS.sessions], backendId, strategyId, key);
}

export async function setStoredSession(
  backendId: string,
  strategyId: string,
  key: string,
  session: StoredSession,
): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.sessions);
  const byBackend = asRecord(stored[STORAGE_KEYS.sessions]);
  const byStrategy = asRecord(byBackend[backendId]);
  await browser.storage.local.set({
    [STORAGE_KEYS.sessions]: {
      ...byBackend,
      [backendId]: { ...byStrategy, [strategyId]: { ...asRecord(byStrategy[strategyId]), [key]: session } },
    },
  });
}

export function readSession(
  store: unknown,
  backendId: string,
  strategyId: string,
  key: string,
): StoredSession | null {
  const entry = asRecord(asRecord(asRecord(store)[backendId])[strategyId])[key];
  const value = asRecord(entry);
  if (typeof value.sessionID !== 'string' || value.sessionID.length === 0) return null;
  if (typeof value.title !== 'string') return null;
  return { sessionID: value.sessionID, title: value.title };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
