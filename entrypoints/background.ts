import { browser } from 'wxt/browser';
import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerComposerHandler } from '@/lib/composer/messages';
import { migrateLegacyConnectionStorage } from '@/lib/connection/migrate';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerOnboardingHandler } from '@/lib/onboarding/install';
import { registerPanelHandler } from '@/lib/panel/messages';
import { registerPickerMessageHandler, registerPickerTriggers } from '@/lib/picker/handler';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';

export default defineBackground(() => {
  registerOnboardingHandler();
  registerBuiltinBackends();
  registerBuiltinSessionStrategies();
  registerConnectionHandler();
  registerPickerMessageHandler();
  registerPickerTriggers();
  registerComposerHandler();
  registerPanelHandler();

  void migrateLegacyConnectionStorage().catch((error: unknown) => {
    console.warn('Browsertalk: legacy storage migration failed', error);
  });

  try {
    void browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(reportSidePanelFailure);
  } catch (error) {
    reportSidePanelFailure(error);
  }
});

function reportSidePanelFailure(error: unknown): void {
  console.warn('Browsertalk: side panel behavior setup failed', error);
}
