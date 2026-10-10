import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerComposerHandler } from '@/lib/composer/messages';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerPickerMessageHandler, registerPickerTriggers } from '@/lib/picker/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';

export default defineBackground(() => {
  registerBuiltinBackends();
  registerBuiltinSessionStrategies();
  registerConnectionHandler();
  registerPickerMessageHandler();
  registerPickerTriggers();
  registerComposerHandler();
});
