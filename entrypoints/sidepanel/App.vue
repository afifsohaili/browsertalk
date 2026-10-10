<script lang="ts" setup>
import { ref } from 'vue';
import ArmPickerButton from '@/components/ArmPickerButton.vue';
import CommentOnPageButton from '@/components/CommentOnPageButton.vue';
import ConnectionPanel from '@/components/ConnectionPanel.vue';
import SettingsLink from '@/components/SettingsLink.vue';
import { useOutboxCount } from '@/lib/composer/use-outbox';

const projectName = ref('—');
const sessionTitle = ref('—');
const { count: outboxCount } = useOutboxCount();
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
      <CommentOnPageButton />
    </div>

    <section>
      <h2>Outbox</h2>
      <p class="empty">{{ outboxCount === 0 ? 'Nothing waiting.' : `${outboxCount} queued` }}</p>
    </section>

    <section>
      <h2>Sent</h2>
      <p class="empty">Nothing sent yet.</p>
    </section>

    <p class="note">Comments queue locally. Sending lands in a later phase.</p>
  </main>
</template>
