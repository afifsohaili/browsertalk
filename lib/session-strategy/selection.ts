import type { AgentBackend } from '@/lib/agent-backend/interface';
import { connectionKey } from '@/lib/connection/identity';
import { connectionBackend, resolveConfiguredConnection } from '@/lib/connection/resolve';
import { getSettings } from '@/lib/storage/settings';
import { isSessionStrategyId, type SessionStrategy, type SessionStrategyId } from './interface';
import { getSessionStrategy } from './registry';

export interface ActiveSessionStrategy {
  backend: AgentBackend;
  strategy: SessionStrategy;
  connectionKey: string;
}

export function pickSessionStrategyId(backend: AgentBackend, override: unknown): SessionStrategyId {
  return isSessionStrategyId(override) ? override : backend.defaultSessionStrategy;
}

export async function resolveActiveSessionStrategy(): Promise<ActiveSessionStrategy> {
  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) throw new Error(resolved.error);

  const { backendId, sessionStrategy } = await getSettings();
  const backend = connectionBackend(resolved.connection);
  const strategy = getSessionStrategy(pickSessionStrategyId(backend, sessionStrategy[backendId]));
  return { backend, strategy, connectionKey: connectionKey(resolved.connection) };
}
