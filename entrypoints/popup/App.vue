<script lang="ts" setup>
import { ref } from 'vue';
import ConnectionPanel from '@/components/ConnectionPanel.vue';

const projectName = ref('—');
const sessionTitle = ref('—');
const outboxCount = ref(0);
const sentCount = ref(0);
</script>

<template>
  <main class="popup">
    <header>
      <h1>opencode Browsertalk</h1>
    </header>

    <ConnectionPanel />

    <div class="actions">
      <button type="button" disabled>Point at element</button>
      <button type="button" disabled>Comment on page</button>
      <button type="button" disabled>Send page URL only</button>
    </div>

    <div class="meta">
      <span>{{ projectName }} · {{ sessionTitle }}</span>
      <span>outbox {{ outboxCount }} · sent {{ sentCount }}</span>
    </div>

    <p class="note">Picker, composer, and sending land in later phases.</p>
  </main>
</template>
