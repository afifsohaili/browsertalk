<script lang="ts" setup>
import { ref } from 'vue';

const connected = ref(false);
const projectName = ref('—');
const sessionTitle = ref('—');
</script>

<template>
  <main class="panel">
    <header>
      <h1>Browsertalk</h1>
      <span class="status" :class="{ online: connected }">
        {{ connected ? 'connected' : 'not connected' }}
      </span>
    </header>

    <section class="targets">
      <div class="row"><span class="label">Project</span><span>{{ projectName }}</span></div>
      <div class="row"><span class="label">Session</span><span>{{ sessionTitle }}</span></div>
    </section>

    <div class="actions">
      <button type="button" disabled>Point at element</button>
      <button type="button" disabled>Comment on page</button>
    </div>

    <section>
      <h2>Outbox</h2>
      <p class="empty">Nothing waiting.</p>
    </section>

    <section>
      <h2>Sent</h2>
      <p class="empty">Nothing sent yet.</p>
    </section>

    <p class="note">Scaffold only — features land in phase 1.</p>
  </main>
</template>
