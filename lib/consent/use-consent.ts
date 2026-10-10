import { computed, getCurrentScope, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue';
import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { acceptConsent, declineConsent, readConsentStatus, type ConsentStatus } from './consent';

export interface ConsentView {
  loaded: Ref<boolean>;
  status: Ref<ConsentStatus | null>;
  accepted: ComputedRef<boolean>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
}

export function useConsent(): ConsentView {
  const loaded = ref(false);
  const status = ref<ConsentStatus | null>(null);
  const accepted = computed(() => status.value === 'accepted');

  async function refresh(): Promise<void> {
    try {
      status.value = await readConsentStatus();
    } finally {
      loaded.value = true;
    }
  }

  async function accept(): Promise<void> {
    await acceptConsent();
    status.value = 'accepted';
  }

  async function decline(): Promise<void> {
    await declineConsent();
    status.value = 'declined';
  }

  function onStorageChanged(changes: Record<string, unknown>): void {
    if (Object.keys(changes).includes(STORAGE_KEYS.consent.status)) void refresh();
  }

  browser.storage.local.onChanged.addListener(onStorageChanged);
  if (getCurrentScope()) {
    onScopeDispose(() => browser.storage.local.onChanged.removeListener(onStorageChanged));
  }

  void refresh();

  return { loaded, status, accepted, accept, decline };
}
