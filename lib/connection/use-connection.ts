import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import type { BackendStatus } from '@/lib/agent-backend/interface';
import { DEFAULT_SERVER_URL, getSettings } from '@/lib/storage/settings';
import { onConnectionChanged, requestConnectionStatus, requestPair } from './messages';

export interface Connection {
  status: Ref<BackendStatus | null>;
  serverUrl: Ref<string>;
  pairing: Ref<boolean>;
  pairError: Ref<string | null>;
  pair: (code: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useConnection(): Connection {
  const status = ref<BackendStatus | null>(null);
  const serverUrl = ref(DEFAULT_SERVER_URL);
  const pairing = ref(false);
  const pairError = ref<string | null>(null);

  async function refresh(): Promise<void> {
    status.value = await requestConnectionStatus();
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

  const stop = onConnectionChanged(() => {
    void refresh();
  });
  if (getCurrentScope()) onScopeDispose(stop);

  void refresh();
  void getSettings().then((settings) => {
    serverUrl.value = settings.serverUrl;
  });

  return { status, serverUrl, pairing, pairError, pair, refresh };
}
