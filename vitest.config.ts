import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest(), vue()],
  test: {
    setupFiles: ['./test/setup/deny-network.ts'],
  },
});
