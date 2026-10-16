<script lang="ts" setup>
import { ref } from 'vue';
import { hasAgentBackend } from '@/lib/agent-backend/registry';
import type { AgentBackendId } from '@/lib/agent-backend/interface';
import { isSessionStrategyId } from '@/lib/session-strategy/interface';
import { useSettingsPage } from '@/lib/settings/use-settings-page';

const {
  loaded,
  backendId,
  serverUrl,
  allowRemote,
  overrides,
  backends,
  strategies,
  error,
  saveBackendId,
  saveServerUrl,
  saveAllowRemote,
  saveStrategyOverride,
} = useSettingsPage();

const urlSaved = ref(false);

function onBackendChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (hasAgentBackend(value)) void saveBackendId(value);
}

function onAllowRemoteChange(event: Event): void {
  void saveAllowRemote((event.target as HTMLInputElement).checked);
}

function onOverrideChange(backend: AgentBackendId, event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === '') {
    void saveStrategyOverride(backend, null);
  } else if (isSessionStrategyId(value)) {
    void saveStrategyOverride(backend, value);
  }
}

async function submitServerUrl(): Promise<void> {
  urlSaved.value = false;
  await saveServerUrl();
  urlSaved.value = error.value === null;
}
</script>

<template>
  <main class="options">
    <header>
      <h1>Browsertalk settings</h1>
    </header>

    <p class="note">Changes apply to the next feedback without a reload.</p>

    <section class="field">
      <label for="backend">Agent backend</label>
      <select v-if="loaded" id="backend" :value="backendId" @change="onBackendChange">
        <option v-for="backend in backends" :key="backend.id" :value="backend.id">{{ backend.label }}</option>
      </select>
    </section>

    <form class="field" @submit.prevent="submitServerUrl">
      <label for="server-url">Server URL</label>
      <div class="url-row">
        <input
          v-if="loaded"
          id="server-url"
          v-model="serverUrl"
          type="text"
          autocomplete="off"
          spellcheck="false"
          @input="urlSaved = false"
        />
        <button type="submit" :disabled="!loaded">Save</button>
        <span v-if="urlSaved" class="saved">Saved</span>
      </div>
    </form>

    <section class="field">
      <label class="remote-toggle">
        <input
          v-if="loaded"
          type="checkbox"
          :checked="allowRemote"
          @change="onAllowRemoteChange"
        />
        Allow a remote server
      </label>
      <p class="hint">
        Off by default. When on, the pairing token and feedback cross your network — keep the link encrypted
        (Tailscale, SSH tunnel) or trusted.
      </p>
    </section>

    <section class="field">
      <h2>Session strategy</h2>
      <p class="hint">Per backend. "Backend default" uses the strategy the backend declares.</p>
      <div v-if="loaded" class="strategies">
        <div v-for="backend in backends" :key="backend.id" class="strategy-row">
          <label :for="`strategy-${backend.id}`">{{ backend.label }}</label>
          <select
            :id="`strategy-${backend.id}`"
            :value="overrides[backend.id] ?? ''"
            @change="onOverrideChange(backend.id, $event)"
          >
            <option value="">Backend default ({{ backend.defaultStrategyLabel }})</option>
            <option v-for="strategy in strategies" :key="strategy.id" :value="strategy.id">
              {{ strategy.label }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>
