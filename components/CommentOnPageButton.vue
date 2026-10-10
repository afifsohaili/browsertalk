<script setup lang="ts">
import { ref } from 'vue';
import { requestOpenComposer } from '@/lib/composer/messages';

const props = withDefaults(defineProps<{ closeOnOpen?: boolean }>(), { closeOnOpen: false });

const busy = ref(false);
const error = ref<string | null>(null);

async function open(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const result = await requestOpenComposer();
    if (!result.ok) {
      error.value = result.error;
      return;
    }
    if (props.closeOnOpen) window.close();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="comment-on-page">
    <button type="button" :disabled="busy" @click="open">Comment on page</button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.comment-on-page {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
}
</style>
