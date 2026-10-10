import { registerBuiltinBackends } from '@/lib/agent-backend';

export default defineBackground(() => {
  registerBuiltinBackends();
});
