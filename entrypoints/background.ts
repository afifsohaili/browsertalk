import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerConnectionHandler } from '@/lib/connection/messages';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';

export default defineBackground(() => {
  registerBuiltinBackends();
  registerBuiltinSessionStrategies();
  registerConnectionHandler();
});
