<script setup lang="ts">
import { computed } from 'vue';
import {
  CONNECTION_ACTIONS,
  CONNECTION_LABELS,
  connectedSummary,
  connectionState,
} from '@/lib/connection/status';
import { useSetup } from '@/lib/onboarding/use-setup';
import { openWelcomeTab } from '@/lib/onboarding/welcome';

const { step, status } = useSetup();

const state = computed(() => (status.value === null ? null : connectionState(status.value)));
const label = computed(() => (state.value === null ? 'Checking…' : CONNECTION_LABELS[state.value]));
const action = computed(() => {
  if (state.value === null || status.value === null) return null;
  return status.value.action ?? CONNECTION_ACTIONS[state.value];
});
const setupIncomplete = computed(() => step.value !== 'checking' && step.value !== 'project');

function openSetup(): void {
  void openWelcomeTab();
}
</script>

<template>
  <section class="connection" :class="state ?? 'checking'" data-connection-state>
    <div class="status-row">
      <span class="status" :class="{ online: state === 'connected' }">{{ label }}</span>
      <span v-if="state === 'connected' && status" class="detail">{{ connectedSummary(status) }}</span>
      <span v-else-if="status" class="detail">{{ status.detail }}</span>
    </div>

    <p v-if="action && state !== 'connected'" class="next">{{ action }}</p>

    <button v-if="setupIncomplete" type="button" class="setup" @click="openSetup">Finish setup</button>
  </section>
</template>

<style scoped>
.connection {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid light-dark(#d1d1d6, #3a3a3c);
  border-radius: 8px;
  background: light-dark(#ffffff, #2c2c2e);
}

.connection.connected {
  border-color: light-dark(#a7d9b4, #2f6b3c);
}

.status-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status {
  font-size: 12px;
  font-weight: 600;
}

.status.online {
  color: #34c759;
}

.detail {
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
  overflow-wrap: anywhere;
}

.next {
  margin: 0;
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
}

.setup {
  align-self: flex-start;
  padding: 4px 8px;
  font-size: 11px;
}
</style>
