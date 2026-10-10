<script lang="ts" setup>
import { computed, ref } from 'vue';
import { PRIVACY_POLICY_URL, type ConsentStatus } from '@/lib/consent/consent';

const props = defineProps<{ status: ConsentStatus | null }>();
const emit = defineEmits<{ accept: []; decline: [] }>();

const reviewing = ref(false);
const showDisclosure = computed(() => props.status === null || reviewing.value);
</script>

<template>
  <main class="consent">
    <header>
      <h1>opencode Browsertalk</h1>
    </header>

    <template v-if="showDisclosure">
      <h2>Before you start</h2>
      <p class="lead">Browsertalk captures feedback you choose to send:</p>
      <ul>
        <li>your comment</li>
        <li>facts about the page and element — URL, title, DOM details, optional element screenshot</li>
      </ul>
      <p class="lead">
        It sends them only to the opencode server on this computer that you run (default
        <code>http://127.0.0.1:15001</code>). Nothing goes to external servers. No analytics.
      </p>
      <p class="note">Nothing is captured before you accept.</p>
      <div class="decisions">
        <button type="button" class="primary" @click="emit('accept')">Accept</button>
        <button type="button" @click="emit('decline')">Decline</button>
      </div>
      <p class="note">
        <a :href="PRIVACY_POLICY_URL" target="_blank" rel="noopener noreferrer">Read the privacy policy</a>
      </p>
    </template>

    <template v-else>
      <p class="lead">You declined. Browsertalk will not capture or send anything.</p>
      <div class="decisions">
        <button type="button" @click="reviewing = true">Review disclosure</button>
      </div>
    </template>
  </main>
</template>

<style scoped>
.consent {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

h2 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: light-dark(#8e8e93, #98989d);
}

.lead {
  margin: 0;
  font-size: 12px;
}

ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.decisions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.decisions button {
  text-align: center;
}

.primary {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

a {
  color: light-dark(#4f46e5, #a5b4fc);
}
</style>
