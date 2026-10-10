import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import type { OriginBindings } from '@/lib/storage/projects';
import { getSettings } from '@/lib/storage/settings';
import { parseLoopbackUrl } from './endpoint';
import { connectionKey } from './identity';

export async function migrateLegacyConnectionStorage(): Promise<void> {
  const { backendId, serverUrl } = await getSettings();
  const parsed = parseLoopbackUrl(serverUrl);
  if (!parsed.ok) return;

  const key = connectionKey({ backendId, endpoint: parsed.endpoint });
  await migrateLegacyToken(key);
  await migrateLegacyBindings(key);
  await migrateLegacySessions(key, backendId);
}

async function migrateLegacyToken(key: string): Promise<void> {
  const stored = await browser.storage.local.get([STORAGE_KEYS.auth.token, STORAGE_KEYS.auth.tokens]);
  const legacy = stored[STORAGE_KEYS.auth.token];
  if (typeof legacy !== 'string' || legacy.length === 0) return;

  const tokens = asRecord(stored[STORAGE_KEYS.auth.tokens]);
  const scoped = tokens[key];
  if (typeof scoped === 'string' && scoped.length > 0) return;

  await browser.storage.local.set({ [STORAGE_KEYS.auth.tokens]: { ...tokens, [key]: legacy } });
  await browser.storage.local.remove(STORAGE_KEYS.auth.token);
}

async function migrateLegacyBindings(key: string): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
  const raw = asRecord(stored[STORAGE_KEYS.projects.byOrigin]);

  const legacy: OriginBindings = {};
  const next: Record<string, unknown> = {};
  for (const [entryKey, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      legacy[entryKey] = value;
    } else {
      next[entryKey] = value;
    }
  }
  if (Object.keys(legacy).length === 0) return;

  next[key] = { ...legacy, ...asRecord(next[key]) };
  await browser.storage.local.set({ [STORAGE_KEYS.projects.byOrigin]: next });
}

async function migrateLegacySessions(key: string, backendId: string): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.sessions);
  const raw = asRecord(stored[STORAGE_KEYS.sessions]);

  const legacy = asRecord(raw[backendId]);
  if (Object.keys(legacy).length === 0) return;
  if (Object.keys(asRecord(raw[key])).length > 0) return;

  const next = { ...raw, [key]: legacy };
  delete next[backendId];
  await browser.storage.local.set({ [STORAGE_KEYS.sessions]: next });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
