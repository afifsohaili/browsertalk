import type { AgentBackend, AgentBackendId, BackendConnectionConfig } from './interface';

export type AgentBackendFactory = (config?: BackendConnectionConfig) => AgentBackend;

const factories = new Map<AgentBackendId, AgentBackendFactory>();

export function registerAgentBackend(id: AgentBackendId, factory: AgentBackendFactory): void {
  if (factories.has(id)) {
    throw new Error(`Agent backend "${id}" is already registered`);
  }
  factories.set(id, factory);
}

export function hasAgentBackend(id: string): boolean {
  return factories.has(id);
}

/** False for test doubles: registered for tests, never offered as a user choice. */
export function isUserSelectableBackend(id: string): boolean {
  const factory = factories.get(id);
  return factory !== undefined && factory().userSelectable !== false;
}

export function getAgentBackend(id: AgentBackendId, config?: BackendConnectionConfig): AgentBackend {
  const factory = factories.get(id);
  if (!factory) {
    const known = [...factories.keys()].join(', ') || 'none';
    throw new Error(`Agent backend "${id}" is not registered. Registered backends: ${known}`);
  }
  return factory(config);
}

export function listAgentBackends(): AgentBackendId[] {
  return [...factories.keys()];
}
