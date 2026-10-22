<script lang="ts" setup>
import { computed, ref } from 'vue';
import { CONNECTION_LABELS, connectedSummary, connectionState } from '@/lib/connection/status';
import { remoteConfirmationCopy, SETUP_COPY } from '@/lib/onboarding/copy';
import { openSidePanel } from '@/lib/onboarding/panel';
import { useSetup } from '@/lib/onboarding/use-setup';

const {
  step,
  status,
  onboarding,
  pairing,
  pairError,
  remoteConfirmation,
  credential,
  submit,
  confirmRemote,
  cancelRemote,
  refresh,
} = useSetup();

const copied = ref(false);
const panelError = ref(false);

const state = computed(() => (status.value === null ? null : connectionState(status.value)));
const label = computed(() => (state.value === null ? 'Checking…' : CONNECTION_LABELS[state.value]));
const command = computed(() => onboarding.value?.command ?? 'opencode pair');
const credentialLabel = computed(() => onboarding.value?.credentialLabel ?? SETUP_COPY.credentialLabel);

async function copyCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

async function openPanel(): Promise<void> {
  panelError.value = !(await openSidePanel());
}
</script>

<template>
  <main class="welcome">
    <header>
      <h1>Set up Browsertalk</h1>
      <span v-if="state" class="live" :class="state">{{ label }}</span>
    </header>

    <p v-if="status" class="detail">
      {{ status.detail }}
      <template v-if="status.version"> · opencode {{ status.version }}</template>
    </p>

    <section class="step prerequisite">
      <h2>1. opencode 2</h2>
      <p>{{ SETUP_COPY.prerequisite }}</p>
      <p v-if="step === 'upgrade'" class="warning">{{ SETUP_COPY.upgrade }}</p>
      <button v-if="step === 'prerequisite'" type="button" @click="refresh">Check again</button>
    </section>

    <section v-if="step === 'pair' || step === 'remote'" class="step">
      <h2>2. Pair</h2>
      <p>{{ SETUP_COPY.runCommand }}</p>
      <div class="command-row">
        <code>{{ command }}</code>
        <button type="button" @click="copyCommand">{{ copied ? 'Copied' : 'Copy' }}</button>
      </div>
      <p class="warning">{{ SETUP_COPY.linkWarning }}</p>
      <p class="hint">{{ SETUP_COPY.expiry }}</p>

      <form v-if="step === 'pair'" class="pair-form" @submit.prevent="submit">
        <label for="credential">{{ credentialLabel }}</label>
        <input
          id="credential"
          v-model="credential"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="credentialLabel"
          data-testid="pairing-input"
        />
        <button type="submit" :disabled="pairing">{{ pairing ? 'Pairing…' : 'Pair' }}</button>
      </form>

      <template v-if="step === 'remote' && remoteConfirmation">
        <p class="warning">{{ remoteConfirmationCopy(remoteConfirmation) }}</p>
        <div class="actions">
          <button type="button" :disabled="pairing" @click="confirmRemote">
            {{ pairing ? 'Pairing…' : 'Pair this server' }}
          </button>
          <button type="button" :disabled="pairing" @click="cancelRemote">Cancel</button>
        </div>
      </template>

      <p v-if="pairError" class="error">{{ pairError }}</p>
    </section>

    <section v-if="step === 'project'" class="step">
      <h2>3. Pick a project</h2>
      <p v-if="status" class="detail">{{ connectedSummary(status) }}</p>
      <p>{{ SETUP_COPY.handoff }}</p>
      <button type="button" class="primary" @click="openPanel">{{ SETUP_COPY.openPanel }}</button>
      <p v-if="panelError" class="error">Open the side panel from the Browsertalk toolbar icon.</p>
    </section>

    <footer>{{ SETUP_COPY.pin }}</footer>
  </main>
</template>
