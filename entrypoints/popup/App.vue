<script lang="ts" setup>
import { ref } from 'vue';
import ArmPickerButton from '@/components/ArmPickerButton.vue';
import CommentOnPageButton from '@/components/CommentOnPageButton.vue';
import ConnectionPanel from '@/components/ConnectionPanel.vue';
import SendUrlOnlyButton from '@/components/SendUrlOnlyButton.vue';
import SettingsLink from '@/components/SettingsLink.vue';
import { useOutboxCount } from '@/lib/composer/use-outbox';

const projectName = ref('—');
const sessionTitle = ref('—');
const sentCount = ref(0);
const { count: outboxCount } = useOutboxCount();
</script>

<template>
  <main class="popup">
    <header>
      <h1>opencode Browsertalk</h1>
      <SettingsLink />
    </header>

    <ConnectionPanel />

    <div class="actions">
      <ArmPickerButton close-on-arm />
      <CommentOnPageButton close-on-open />
      <SendUrlOnlyButton />
    </div>

    <div class="meta">
      <span>{{ projectName }} · {{ sessionTitle }}</span>
      <span>outbox {{ outboxCount }} · sent {{ sentCount }}</span>
    </div>

    <p class="note">Comments queue locally. Sending lands in a later phase.</p>
  </main>
</template>
