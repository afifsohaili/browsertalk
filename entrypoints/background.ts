import { browser } from 'wxt/browser';
import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerComposerHandler } from '@/lib/composer/messages';
import { migrateLegacyConnectionStorage } from '@/lib/connection/migrate';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerOnboardingHandler } from '@/lib/onboarding/install';
import { registerPanelHandler } from '@/lib/panel/messages';
import { registerPickerMessageHandler, registerPickerTriggers } from '@/lib/picker/handler';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';

export default defineBackground(async () => {
  registerOnboardingHandler();
  registerBuiltinBackends();
  registerBuiltinSessionStrategies();
  await migrateLegacyConnectionStorage();
  registerConnectionHandler();
  registerPickerMessageHandler();
  registerPickerTriggers();
  registerComposerHandler();
  registerPanelHandler();

  try {
    await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn('Browsertalk: side panel behavior setup failed', error);
  }
});
