import { FakeAgentBackend } from './fake';
import { OpenCodeBackend } from './opencode';
import { registerAgentBackend } from './registry';

export function registerBuiltinBackends(): void {
  registerAgentBackend('opencode', (config) => new OpenCodeBackend(config));
  registerAgentBackend('fake', () => new FakeAgentBackend());
}
