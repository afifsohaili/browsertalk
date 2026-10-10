import type { AgentBackend, AgentBackendId } from './interface';

export type AgentBackendFactory = () => AgentBackend;

const factories = new Map<AgentBackendId, AgentBackendFactory>();

export function registerAgentBackend(id: AgentBackendId, factory: AgentBackendFactory): void {
  if (factories.has(id)) {
    throw new Error(`Agent backend "${id}" is already registered`);
  }
  factories.set(id, factory);
}

export function getAgentBackend(id: AgentBackendId): AgentBackend {
  const factory = factories.get(id);
  if (!factory) {
    const known = [...factories.keys()].join(', ') || 'none';
    throw new Error(`Agent backend "${id}" is not registered. Registered backends: ${known}`);
  }
  return factory();
}

export function listAgentBackends(): AgentBackendId[] {
  return [...factories.keys()];
}
