import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import { browser } from 'wxt/browser';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import {
  onConnectionChanged,
  requestConnectionStatus,
  requestOnboarding,
  requestPair,
  requestReset,
  type PairRequestOptions,
} from './messages';
import type { OnboardingView, RemotePairingConfirmation } from './protocol';

export interface Connection {
  status: Ref<BackendStatus | null>;
  onboarding: Ref<OnboardingView | null>;
  pairing: Ref<boolean>;
  pairError: Ref<string | null>;
  /** A remote link waiting for the user's confirmation. */
  remoteConfirmation: Ref<RemotePairingConfirmation | null>;
  pair: (code: string) => Promise<boolean>;
  confirmRemote: () => Promise<boolean>;
  cancelRemote: () => void;
  forget: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useConnection(): Connection {
  const status = ref<BackendStatus | null>(null);
  const onboarding = ref<OnboardingView | null>(null);
  const pairing = ref(false);
  const pairError = ref<string | null>(null);
  const remoteConfirmation = ref<RemotePairingConfirmation | null>(null);
  let pendingCredential: string | null = null;
  let generation = 0;

  async function refresh(): Promise<void> {
    const current = ++generation;
    const [nextStatus, nextOnboarding] = await Promise.all([requestConnectionStatus(), requestOnboarding()]);
    if (current !== generation) return;
    status.value = nextStatus;
    onboarding.value = nextOnboarding;
  }

  async function pair(code: string, options: PairRequestOptions = {}): Promise<boolean> {
    pairing.value = true;
    pairError.value = null;
    try {
      const result = await requestPair(code, options);
      if (!result.ok) {
        if (result.remote !== undefined) {
          remoteConfirmation.value = result.remote;
          pendingCredential = code;
        } else {
          pairError.value = result.error;
        }
        return false;
      }
      remoteConfirmation.value = null;
      pendingCredential = null;
      return true;
    } finally {
      pairing.value = false;
    }
  }

  async function confirmRemote(): Promise<boolean> {
    if (pendingCredential === null) return false;
    return pair(pendingCredential, { confirmRemote: true });
  }

  function cancelRemote(): void {
    remoteConfirmation.value = null;
    pendingCredential = null;
  }

  async function forget(): Promise<boolean> {
    pairError.value = null;
    const result = await requestReset();
    if (!result.ok) {
      pairError.value = result.error;
      return false;
    }
    remoteConfirmation.value = null;
    pendingCredential = null;
    return true;
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

  return {
    status,
    onboarding,
    pairing,
    pairError,
    remoteConfirmation,
    pair,
    confirmRemote,
    cancelRemote,
    forget,
    refresh,
  };
}
