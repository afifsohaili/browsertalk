import { browser } from 'wxt/browser';
import { isAgentBackendId, type AgentBackendId } from '@/lib/agent-backend/interface';
import { hasAgentBackend } from '@/lib/agent-backend/registry';
import { parseLoopbackUrl } from '@/lib/connection/endpoint';
import { isSessionStrategyId, type SessionStrategyId } from '@/lib/session-strategy/interface';
import { STORAGE_KEYS } from './keys';

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:15001';
export const DEFAULT_BACKEND_ID: AgentBackendId = 'opencode';

export type SessionStrategyOverrides = Partial<Record<AgentBackendId, SessionStrategyId>>;

export interface Settings {
  backendId: AgentBackendId;
  serverUrl: string;
  sessionStrategy: SessionStrategyOverrides;
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.settings.backendId,
    STORAGE_KEYS.settings.serverUrl,
    STORAGE_KEYS.settings.sessionStrategy,
  ]);
  const backendId = stored[STORAGE_KEYS.settings.backendId];
  const serverUrl = stored[STORAGE_KEYS.settings.serverUrl];

  return {
    backendId: isAgentBackendId(backendId) ? backendId : DEFAULT_BACKEND_ID,
    serverUrl: typeof serverUrl === 'string' && serverUrl.length > 0 ? serverUrl : DEFAULT_SERVER_URL,
    sessionStrategy: readSessionStrategyOverrides(stored[STORAGE_KEYS.settings.sessionStrategy]),
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.backendId !== undefined) values[STORAGE_KEYS.settings.backendId] = patch.backendId;
  if (patch.serverUrl !== undefined) {
    const parsed = parseLoopbackUrl(patch.serverUrl);
    if (!parsed.ok) throw new Error(parsed.error);
    values[STORAGE_KEYS.settings.serverUrl] = parsed.endpoint;
  }
  if (patch.sessionStrategy !== undefined) values[STORAGE_KEYS.settings.sessionStrategy] = patch.sessionStrategy;
  if (Object.keys(values).length > 0) await browser.storage.local.set(values);
}

export function readSessionStrategyOverrides(value: unknown): SessionStrategyOverrides {
  if (typeof value !== 'object' || value === null) return {};

  const entries = Object.entries(value).filter(
    (entry): entry is [AgentBackendId, SessionStrategyId] =>
      isAgentBackendId(entry[0]) && isSessionStrategyId(entry[1]),
  );
  return Object.fromEntries(entries);
}

export async function setSessionStrategyOverride(
  backendId: AgentBackendId,
  strategyId: SessionStrategyId | null,
): Promise<void> {
  if (!hasAgentBackend(backendId)) throw new Error(`Unknown agent backend "${backendId}"`);
  if (strategyId !== null && !isSessionStrategyId(strategyId)) {
    throw new Error(`Unknown session strategy "${strategyId}"`);
  }

  const { sessionStrategy } = await getSettings();
  const next: SessionStrategyOverrides = { ...sessionStrategy };
  if (strategyId === null) {
    delete next[backendId];
  } else {
    next[backendId] = strategyId;
  }
  await setSettings({ sessionStrategy: next });
}
