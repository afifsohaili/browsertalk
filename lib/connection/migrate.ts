import { browser } from 'wxt/browser';
import type { AgentBackendId } from '@/lib/agent-backend/interface';
import { isUserSelectableBackend } from '@/lib/agent-backend/registry';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import type { OriginBindings } from '@/lib/storage/projects';
import { DEFAULT_BACKEND_ID, getSettings, setSettings } from '@/lib/storage/settings';
import { parseServerUrl } from './endpoint';
import { connectionKey, type ConnectionIdentity } from './identity';
import { isConnectionIdentity } from './protocol';

export async function migrateLegacyConnectionStorage(): Promise<void> {
  await normalizeStoredBackend();
  const owner = await readMigrationOwner();
  if (owner.state === 'owner') {
    await migrateForConnection(owner.connection);
    return;
  }
  if (owner.state === 'unreadable') return;

  const { backendId, serverUrl, allowRemote } = await getSettings();
  const parsed = parseServerUrl(serverUrl, { allowRemote });
  if (!parsed.ok) return;

  const connection: ConnectionIdentity = { backendId, endpoint: parsed.endpoint };
  if (!(await hasLegacyConnectionData(backendId))) return;

  await browser.storage.local.set({ [STORAGE_KEYS.migration.owner]: connection });
  await migrateForConnection(connection);
}

/**
 * A test-only backend has no product path. Boot moves a stored one to the default user choice so
 * ping, pairing, and delivery never reach the fake before the settings page loads.
 */
async function normalizeStoredBackend(): Promise<void> {
  const { backendId } = await getSettings();
  if (isUserSelectableBackend(backendId)) return;
  await setSettings({ backendId: DEFAULT_BACKEND_ID });
}

async function migrateForConnection(connection: ConnectionIdentity): Promise<void> {
  const key = connectionKey(connection);
  await migrateLegacyToken(key);
  await migrateLegacyBindings(key);
  await migrateLegacySessions(key, connection.backendId);
}

type MigrationOwner =
  | { state: 'none' }
  | { state: 'unreadable' }
  | { state: 'owner'; connection: ConnectionIdentity };

async function readMigrationOwner(): Promise<MigrationOwner> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.migration.owner);
  const value = stored[STORAGE_KEYS.migration.owner];
  if (value === undefined) return { state: 'none' };
  if (isConnectionIdentity(value)) return { state: 'owner', connection: normalizeIdentity(value) };
  return { state: 'unreadable' };
}

function normalizeIdentity(identity: ConnectionIdentity): ConnectionIdentity {
  return isUserSelectableBackend(identity.backendId)
    ? identity
    : { ...identity, backendId: DEFAULT_BACKEND_ID };
}

async function hasLegacyConnectionData(backendId: AgentBackendId): Promise<boolean> {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.auth.token,
    STORAGE_KEYS.projects.byOrigin,
    STORAGE_KEYS.sessions,
  ]);

  const legacyToken = stored[STORAGE_KEYS.auth.token];
  if (typeof legacyToken === 'string' && legacyToken.length > 0) return true;

  const bindings = asRecord(stored[STORAGE_KEYS.projects.byOrigin]);
  if (Object.values(bindings).some((entry) => typeof entry === 'string')) return true;

  const sessions = asRecord(stored[STORAGE_KEYS.sessions]);
  return Object.keys(asRecord(sessions[backendId])).length > 0;
}

async function migrateLegacyToken(key: string): Promise<void> {
  const stored = await browser.storage.local.get([STORAGE_KEYS.auth.token, STORAGE_KEYS.auth.tokens]);
  const legacy = stored[STORAGE_KEYS.auth.token];
  if (typeof legacy !== 'string' || legacy.length === 0) return;

  const tokens = asRecord(stored[STORAGE_KEYS.auth.tokens]);
  const scoped = tokens[key];
  if (!(typeof scoped === 'string' && scoped.length > 0)) {
    await browser.storage.local.set({ [STORAGE_KEYS.auth.tokens]: { ...tokens, [key]: legacy } });
  }
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

  const scoped = asRecord(raw[key]);
  const next = { ...raw, [key]: mergeStrategyStores(legacy, scoped) };
  delete next[backendId];
  await browser.storage.local.set({ [STORAGE_KEYS.sessions]: next });
}

function mergeStrategyStores(legacy: Record<string, unknown>, scoped: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...legacy };
  for (const [strategyId, refs] of Object.entries(scoped)) {
    merged[strategyId] = { ...asRecord(merged[strategyId]), ...asRecord(refs) };
  }
  return merged;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
