import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerConnectionHandler } from '@/lib/connection/messages';

export default defineBackground(() => {
  registerBuiltinBackends();
  registerConnectionHandler();
});
