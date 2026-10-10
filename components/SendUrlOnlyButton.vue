<script setup lang="ts">
import { ref } from 'vue';
import { requestQueueUrlOnly } from '@/lib/composer/messages';

const busy = ref(false);
const error = ref<string | null>(null);
const note = ref<string | null>(null);

async function send(): Promise<void> {
  busy.value = true;
  error.value = null;
  note.value = null;
  try {
    const result = await requestQueueUrlOnly();
    if (!result.ok) {
      error.value = result.error;
      return;
    }
    note.value = 'Queued';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="send-url-only">
    <button type="button" :disabled="busy" @click="send">Send page URL only</button>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="note" class="note">{{ note }}</p>
  </div>
</template>

<style scoped>
.send-url-only {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
}

.note {
  margin: 0;
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
}
</style>
