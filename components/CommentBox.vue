<script setup lang="ts">
import { computed, ref } from 'vue';
import { requestPageComment } from '@/lib/composer/messages';

const comment = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const note = ref<string | null>(null);

const trimmed = computed(() => comment.value.trim());
const actionLabel = computed(() => (trimmed.value.length === 0 ? 'Send URL only' : 'Send'));

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return;
  event.preventDefault();
  void send();
}

async function send(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  note.value = null;
  try {
    const result = await requestPageComment(trimmed.value);
    if (!result.ok) {
      error.value = result.error;
      return;
    }
    comment.value = '';
    note.value = 'Queued';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="comment-box">
    <textarea
      v-model="comment"
      rows="3"
      placeholder="What looks wrong?"
      spellcheck="false"
      @keydown.enter="onEnter"
    />
    <div class="footer">
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="note" class="note">{{ note }}</p>
      <span v-else class="hint">Enter sends · Shift+Enter newline</span>
      <button type="button" :disabled="busy" @click="send">{{ busy ? 'Sending…' : actionLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.comment-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid light-dark(#d1d1d6, #3a3a3c);
  border-radius: 8px;
  background: light-dark(#ffffff, #2c2c2e);
  color: inherit;
  font: inherit;
  resize: vertical;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.footer button {
  padding: 4px 10px;
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
}

.note,
.hint {
  margin: 0;
  font-size: 11px;
  color: light-dark(#8e8e93, #98989d);
}

.error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
  overflow-wrap: anywhere;
}
</style>
