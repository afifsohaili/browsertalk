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
  let generation = 0;

  async function refresh(): Promise<void> {
    const read = ++generation;
    try {
      const next = await readConsentStatus();
      if (read === generation) status.value = next;
    } finally {
      if (read === generation) loaded.value = true;
    }
  }

  async function accept(): Promise<void> {
    const write = ++generation;
    await acceptConsent();
    if (write !== generation) return;
    status.value = 'accepted';
    loaded.value = true;
  }

  async function decline(): Promise<void> {
    const write = ++generation;
    await declineConsent();
    if (write !== generation) return;
    status.value = 'declined';
    loaded.value = true;
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
