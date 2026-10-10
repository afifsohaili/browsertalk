import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import { onOutboxChanged, requestOutboxCount } from './messages';

export interface OutboxCount {
  count: Ref<number>;
  refresh: () => Promise<void>;
}

export function useOutboxCount(): OutboxCount {
  const count = ref(0);

  async function refresh(): Promise<void> {
    const result = await requestOutboxCount();
    if (result.ok) count.value = result.count;
  }

  const stop = onOutboxChanged(() => {
    void refresh();
  });
  if (getCurrentScope()) onScopeDispose(stop);

  void refresh();

  return { count, refresh };
}
