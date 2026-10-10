import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import type { BackendStatus } from '@/lib/agent-backend/interface';
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

  async function refresh(): Promise<void> {
    const [nextStatus, nextOnboarding] = await Promise.all([requestConnectionStatus(), requestOnboarding()]);
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

  const stop = onConnectionChanged(() => {
    void refresh();
  });
  if (getCurrentScope()) onScopeDispose(stop);

  void refresh();

  return { status, onboarding, pairing, pairError, pair, refresh };
}
