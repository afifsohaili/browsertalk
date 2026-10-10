import { FakeAgentBackend } from './fake';
import { DEFAULT_SERVER_URL, OpenCodeBackend } from './opencode';
import { registerAgentBackend } from './registry';

export function registerBuiltinBackends(): void {
  registerAgentBackend('opencode', () => new OpenCodeBackend({ baseUrl: DEFAULT_SERVER_URL, token: '' }));
  registerAgentBackend('fake', () => new FakeAgentBackend());
}
