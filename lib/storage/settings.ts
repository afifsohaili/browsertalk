import { browser } from 'wxt/browser';
import { isAgentBackendId, type AgentBackendId } from '@/lib/agent-backend/interface';
import { STORAGE_KEYS } from './keys';

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:15001';
export const DEFAULT_BACKEND_ID: AgentBackendId = 'opencode';

export interface Settings {
  backendId: AgentBackendId;
  serverUrl: string;
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.settings.backendId,
    STORAGE_KEYS.settings.serverUrl,
  ]);
  const backendId = stored[STORAGE_KEYS.settings.backendId];
  const serverUrl = stored[STORAGE_KEYS.settings.serverUrl];

  return {
    backendId: isAgentBackendId(backendId) ? backendId : DEFAULT_BACKEND_ID,
    serverUrl: typeof serverUrl === 'string' && serverUrl.length > 0 ? serverUrl : DEFAULT_SERVER_URL,
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const values: Record<string, string> = {};
  if (patch.backendId !== undefined) values[STORAGE_KEYS.settings.backendId] = patch.backendId;
  if (patch.serverUrl !== undefined) values[STORAGE_KEYS.settings.serverUrl] = patch.serverUrl;
  if (Object.keys(values).length > 0) await browser.storage.local.set(values);
}
