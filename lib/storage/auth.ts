import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export async function getToken(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.auth.token);
  const token = stored[STORAGE_KEYS.auth.token];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function setToken(token: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.auth.token]: token });
}

export async function clearToken(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.auth.token);
}
