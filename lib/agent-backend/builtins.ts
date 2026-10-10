import { FakeAgentBackend } from './fake';
import { OpenCodeBackend } from './opencode';
import { registerAgentBackend } from './registry';

export function registerBuiltinBackends(): void {
  registerAgentBackend('opencode', () => new OpenCodeBackend());
  registerAgentBackend('fake', () => new FakeAgentBackend());
}
