import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerComposerHandler } from '@/lib/composer/messages';
import { migrateLegacyConnectionStorage } from '@/lib/connection/migrate';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerPanelHandler } from '@/lib/panel/messages';
import { registerPickerMessageHandler, registerPickerTriggers } from '@/lib/picker/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';

export default defineBackground(async () => {
  registerBuiltinBackends();
  registerBuiltinSessionStrategies();
  await migrateLegacyConnectionStorage();
  registerConnectionHandler();
  registerPickerMessageHandler();
  registerPickerTriggers();
  registerComposerHandler();
  registerPanelHandler();
});
