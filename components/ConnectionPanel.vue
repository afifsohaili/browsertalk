<script setup lang="ts">
import { computed, ref } from 'vue';
import { useConnection } from '@/lib/connection/use-connection';

const { status, serverUrl, pairing, pairError, pair } = useConnection();
const code = ref('');

const statusText = computed(() => {
  if (status.value === null) return 'checking…';
  return status.value.ok ? 'connected' : 'not connected';
});

async function submit(): Promise<void> {
  if (await pair(code.value)) code.value = '';
}
</script>

<template>
  <section class="connection">
    <div class="status-row">
      <span class="status" :class="{ online: status?.ok === true }">{{ statusText }}</span>
      <span v-if="status" class="detail">{{ status.detail }}</span>
    </div>

    <form v-if="status && !status.ok" class="pair" @submit.prevent="submit">
      <p class="hint">
        Run <code>opencode api post /api/pair --server {{ serverUrl }}</code> and paste the code:
      </p>
      <div class="pair-row">
        <input v-model="code" type="text" placeholder="Pairing code" autocomplete="off" spellcheck="false" />
        <button type="submit" :disabled="pairing || code.trim().length === 0">
          {{ pairing ? 'pairing…' : 'pair' }}
        </button>
      </div>
      <p v-if="pairError" class="error">{{ pairError }}</p>
    </form>
  </section>
</template>

<style scoped>
.connection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.status {
  font-size: 11px;
  color: light-dark(#8e8e93, #98989d);
}

.status.online {
  color: #34c759;
}

.detail {
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
}

.pair {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
}

.hint code {
  font-size: 10px;
  word-break: break-all;
}

.pair-row {
  display: flex;
  gap: 6px;
}

.pair-row input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid light-dark(#d1d1d6, #3a3a3c);
  border-radius: 8px;
  background: light-dark(#ffffff, #2c2c2e);
  color: inherit;
  font: inherit;
}

.pair-row button {
  padding: 6px 10px;
  text-align: center;
}

.error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
}
</style>
