import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'opencode Browsertalk',
    description: 'Send browser feedback straight into opencode sessions.',
    action: { default_title: 'Open Browsertalk panel' },
    permissions: ['storage', 'sidePanel', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    commands: {
      'arm-picker': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Point at an element and comment',
      },
    },
  },
});
