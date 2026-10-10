import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { onConnectionChanged, requestConnectionStatus, requestOnboarding, requestPair } from './messages';
import type { OnboardingView } from './protocol';

export interface Connection {
  status: Ref<BackendStatus | null>;
  onboarding: Ref<OnboardingView | null>;
  pairing: Ref<boolean>;
  pairError: Ref<string | null>;
  pair: (code: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useConnection(): Connection {
  const status = ref<BackendStatus | null>(null);
  const onboarding = ref<OnboardingView | null>(null);
  const pairing = ref(false);
  const pairError = ref<string | null>(null);
  let generation = 0;

  async function refresh(): Promise<void> {
    const current = ++generation;
    const [nextStatus, nextOnboarding] = await Promise.all([requestConnectionStatus(), requestOnboarding()]);
    if (current !== generation) return;
    status.value = nextStatus;
    onboarding.value = nextOnboarding;
  }

  async function pair(code: string): Promise<boolean> {
    pairing.value = true;
    pairError.value = null;
    try {
      const result = await requestPair(code);
      if (!result.ok) {
        pairError.value = result.error;
        return false;
      }
      return true;
    } finally {
      pairing.value = false;
    }
  }

  function onStorageChanged(changes: Record<string, unknown>): void {
    const keys = Object.keys(changes);
    if (keys.includes(STORAGE_KEYS.settings.backendId) || keys.includes(STORAGE_KEYS.settings.serverUrl)) {
      void refresh();
    }
  }

  const stop = onConnectionChanged(() => {
    void refresh();
  });
  browser.storage.local.onChanged.addListener(onStorageChanged);

  function dispose(): void {
    stop();
    browser.storage.local.onChanged.removeListener(onStorageChanged);
  }
  if (getCurrentScope()) onScopeDispose(dispose);

  void refresh();

  return { status, onboarding, pairing, pairError, pair, refresh };
}
