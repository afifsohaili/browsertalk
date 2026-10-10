import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export interface StoredSession {
  sessionID: string;
  title: string;
  generation: number;
}

export async function getStoredSession(
  connectionKey: string,
  strategyId: string,
  key: string,
): Promise<StoredSession | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.sessions);
  return readSession(stored[STORAGE_KEYS.sessions], connectionKey, strategyId, key);
}

export function readSession(
  store: unknown,
  connectionKey: string,
  strategyId: string,
  key: string,
): StoredSession | null {
  const entry = asRecord(asRecord(asRecord(store)[connectionKey])[strategyId])[key];
  const value = asRecord(entry);
  if (typeof value.sessionID !== 'string' || value.sessionID.length === 0) return null;
  if (typeof value.title !== 'string') return null;
  return { sessionID: value.sessionID, title: value.title, generation: readGeneration(value.generation) };
}

function readGeneration(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
