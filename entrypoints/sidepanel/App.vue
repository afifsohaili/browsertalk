<script lang="ts" setup>
import { ref } from 'vue';
import ArmPickerButton from '@/components/ArmPickerButton.vue';
import ConnectionPanel from '@/components/ConnectionPanel.vue';
import SettingsLink from '@/components/SettingsLink.vue';

const projectName = ref('—');
const sessionTitle = ref('—');
</script>

<template>
  <main class="panel">
    <header>
      <h1>Browsertalk</h1>
      <SettingsLink />
    </header>

    <ConnectionPanel />

    <section class="targets">
      <div class="row"><span class="label">Project</span><span>{{ projectName }}</span></div>
      <div class="row"><span class="label">Session</span><span>{{ sessionTitle }}</span></div>
    </section>

    <div class="actions">
      <ArmPickerButton />
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

    <p class="note">Composer and sending land in later phases.</p>
  </main>
</template>
