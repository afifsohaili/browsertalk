import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export async function getToken(connectionKey: string): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.auth.tokens);
  const tokens = asRecord(stored[STORAGE_KEYS.auth.tokens]);
  const token = tokens[connectionKey];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function setToken(connectionKey: string, token: string): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.auth.tokens);
  const tokens = asRecord(stored[STORAGE_KEYS.auth.tokens]);
  await browser.storage.local.set({ [STORAGE_KEYS.auth.tokens]: { ...tokens, [connectionKey]: token } });
}

export async function clearToken(connectionKey: string): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.auth.tokens);
  const tokens = asRecord(stored[STORAGE_KEYS.auth.tokens]);
  const next = { ...tokens };
  delete next[connectionKey];
  await browser.storage.local.set({ [STORAGE_KEYS.auth.tokens]: next });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
