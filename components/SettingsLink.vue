<script setup lang="ts">
import { browser } from 'wxt/browser';

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}
</script>

<template>
  <button type="button" class="settings-link" @click="openSettings">Settings</button>
</template>

<style scoped>
.settings-link {
  padding: 0;
  border: none;
  background: none;
  color: light-dark(#636366, #aeaeb2);
  font: inherit;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
