import { ref, type Ref } from 'vue';
import type { AgentBackendId } from '@/lib/agent-backend/interface';
import { getAgentBackend, listAgentBackends } from '@/lib/agent-backend/registry';
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
  overrides: Ref<SessionStrategyOverrides>;
  backends: SettingsBackendChoice[];
  strategies: SettingsStrategyChoice[];
  error: Ref<string | null>;
  saveBackendId: (id: AgentBackendId) => Promise<void>;
  saveServerUrl: () => Promise<void>;
  saveStrategyOverride: (backend: AgentBackendId, strategyId: SessionStrategyId | null) => Promise<void>;
}

export function useSettingsPage(): SettingsPage {
  const loaded = ref(false);
  const backendId = ref<AgentBackendId>(DEFAULT_BACKEND_ID);
  const serverUrl = ref(DEFAULT_SERVER_URL);
  const overrides = ref<SessionStrategyOverrides>({});
  const error = ref<string | null>(null);

  const backends = listAgentBackends().map((id) => {
    const backend = getAgentBackend(id);
    return {
      id,
      label: backend.label,
      defaultStrategyLabel: getSessionStrategy(backend.defaultSessionStrategy).label,
    };
  });
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
      backendId.value = settings.backendId;
      serverUrl.value = settings.serverUrl;
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
      serverUrl.value = value;
    });
  }

  function saveStrategyOverride(backend: AgentBackendId, strategyId: SessionStrategyId | null): Promise<void> {
    return persist(async () => {
      await setSessionStrategyOverride(backend, strategyId);
      overrides.value = (await getSettings()).sessionStrategy;
    });
  }

  void load();

  return {
    loaded,
    backendId,
    serverUrl,
    overrides,
    backends,
    strategies,
    error,
    saveBackendId,
    saveServerUrl,
    saveStrategyOverride,
  };
}
