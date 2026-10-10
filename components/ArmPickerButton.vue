<script setup lang="ts">
import { ref } from 'vue';
import { requestArmPicker } from '@/lib/picker/messages';

const props = withDefaults(defineProps<{ closeOnArm?: boolean }>(), { closeOnArm: false });

const busy = ref(false);
const error = ref<string | null>(null);
const note = ref<string | null>(null);

async function arm(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const result = await requestArmPicker();
    if (!result.ok) {
      error.value = result.error;
      note.value = null;
      return;
    }
    note.value = result.armed ? 'Picker armed' : 'Picker disarmed';
    if (props.closeOnArm && result.armed) window.close();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="arm-picker">
    <button type="button" :disabled="busy" @click="arm">Point at element</button>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="note" class="note">{{ note }}</p>
  </div>
</template>

<style scoped>
.arm-picker {
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
