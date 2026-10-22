import { ref, type Ref } from 'vue';
import type { AgentBackendId, BackendStatus } from '@/lib/agent-backend/interface';
import { getAgentBackend, listAgentBackends } from '@/lib/agent-backend/registry';
import { requestConnectionStatus, requestReset } from '@/lib/connection/messages';
import type { SessionStrategyId } from '@/lib/session-strategy/interface';
import { getSessionStrategy, listSessionStrategies } from '@/lib/session-strategy/registry';
import {
  DEFAULT_BACKEND_ID,
  DEFAULT_SERVER_URL,
  getSettings,
  setSessionStrategyOverride,
  setSettings,
  type SessionStrategyOverrides,
} from '@/lib/storage/settings';

export interface SettingsBackendChoice {
  id: AgentBackendId;
  label: string;
  defaultStrategyLabel: string;
}

export interface SettingsStrategyChoice {
  id: SessionStrategyId;
  label: string;
}

export interface SettingsPage {
  loaded: Ref<boolean>;
  backendId: Ref<AgentBackendId>;
  serverUrl: Ref<string>;
  allowRemote: Ref<boolean>;
  overrides: Ref<SessionStrategyOverrides>;
  backends: SettingsBackendChoice[];
  strategies: SettingsStrategyChoice[];
  error: Ref<string | null>;
  status: Ref<BackendStatus | null>;
  testing: Ref<boolean>;
  forgetting: Ref<boolean>;
  saveBackendId: (id: AgentBackendId) => Promise<void>;
  saveServerUrl: () => Promise<void>;
  saveAllowRemote: (value: boolean) => Promise<void>;
  saveStrategyOverride: (backend: AgentBackendId, strategyId: SessionStrategyId | null) => Promise<void>;
  testConnection: () => Promise<void>;
  forgetPairing: () => Promise<boolean>;
}

export function useSettingsPage(): SettingsPage {
  const loaded = ref(false);
  const backendId = ref<AgentBackendId>(DEFAULT_BACKEND_ID);
  const serverUrl = ref(DEFAULT_SERVER_URL);
  const allowRemote = ref(false);
  const overrides = ref<SessionStrategyOverrides>({});
  const error = ref<string | null>(null);
  const status = ref<BackendStatus | null>(null);
  const testing = ref(false);
  const forgetting = ref(false);

  const backends = listAgentBackends()
    .filter((id) => getAgentBackend(id).userSelectable !== false)
    .map((id) => {
      const backend = getAgentBackend(id);
      return {
        id,
        label: backend.label,
        defaultStrategyLabel: getSessionStrategy(backend.defaultSessionStrategy).label,
      };
    });
  const visibleIds = new Set(backends.map((backend) => backend.id));
  const strategies = listSessionStrategies().map((id) => ({ id, label: getSessionStrategy(id).label }));

  async function persist(action: () => Promise<void>): Promise<void> {
    error.value = null;
    try {
      await action();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  function load(): Promise<void> {
    return persist(async () => {
      const settings = await getSettings();
      if (visibleIds.has(settings.backendId)) {
        backendId.value = settings.backendId;
      } else {
        // A stored test double (or a removed backend) resolves to the default user choice.
        await setSettings({ backendId: DEFAULT_BACKEND_ID });
        backendId.value = DEFAULT_BACKEND_ID;
      }
      serverUrl.value = settings.serverUrl;
      allowRemote.value = settings.allowRemote;
      overrides.value = settings.sessionStrategy;
      loaded.value = true;
    });
  }

  function saveBackendId(id: AgentBackendId): Promise<void> {
    return persist(async () => {
      await setSettings({ backendId: id });
      backendId.value = id;
    });
  }

  function saveServerUrl(): Promise<void> {
    return persist(async () => {
      const value = serverUrl.value.trim() || DEFAULT_SERVER_URL;
      await setSettings({ serverUrl: value });
      serverUrl.value = (await getSettings()).serverUrl;
    });
  }

  function saveAllowRemote(value: boolean): Promise<void> {
    return persist(async () => {
      await setSettings({ allowRemote: value });
      allowRemote.value = (await getSettings()).allowRemote;
    });
  }

  function saveStrategyOverride(backend: AgentBackendId, strategyId: SessionStrategyId | null): Promise<void> {
    return persist(async () => {
      await setSessionStrategyOverride(backend, strategyId);
      overrides.value = (await getSettings()).sessionStrategy;
    });
  }

  async function testConnection(): Promise<void> {
    testing.value = true;
    try {
      status.value = await requestConnectionStatus();
    } finally {
      testing.value = false;
    }
  }

  async function forgetPairing(): Promise<boolean> {
    error.value = null;
    forgetting.value = true;
    try {
      const result = await requestReset();
      if (!result.ok) {
        error.value = result.error;
        return false;
      }
      await testConnection();
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      forgetting.value = false;
    }
  }

  void load();

  return {
    loaded,
    backendId,
    serverUrl,
    allowRemote,
    overrides,
    backends,
    strategies,
    error,
    status,
    testing,
    forgetting,
    saveBackendId,
    saveServerUrl,
    saveAllowRemote,
    saveStrategyOverride,
    testConnection,
    forgetPairing,
  };
}
