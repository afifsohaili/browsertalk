import type { AgentBackend } from '@/lib/agent-backend/interface';
import { connectionKey, type ConnectionIdentity } from '@/lib/connection/identity';
import {
  connectionBackend,
  resolveConfiguredConnection,
  resolveConnection,
  type ConfiguredConnection,
} from '@/lib/connection/resolve';
import { getSettings } from '@/lib/storage/settings';
import { isSessionStrategyId, type SessionStrategy, type SessionStrategyId } from './interface';
import { getSessionStrategy } from './registry';

export interface ActiveSessionStrategy {
  backend: AgentBackend;
  strategy: SessionStrategy;
  connectionKey: string;
  connection: ConfiguredConnection;
}

export function pickSessionStrategyId(backend: AgentBackend, override: unknown): SessionStrategyId {
  return isSessionStrategyId(override) ? override : backend.defaultSessionStrategy;
}

export async function resolveActiveSessionStrategy(): Promise<ActiveSessionStrategy> {
  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) throw new Error(resolved.error);
  return activeStrategyFor(resolved.connection);
}

export async function resolveSessionStrategyFor(connection: ConnectionIdentity): Promise<ActiveSessionStrategy> {
  const resolved = await resolveConnection(connection);
  if (!resolved.ok) throw new Error(resolved.error);
  return activeStrategyFor(resolved.connection);
}

async function activeStrategyFor(connection: ConfiguredConnection): Promise<ActiveSessionStrategy> {
  const { sessionStrategy } = await getSettings();
  const backend = connectionBackend(connection);
  const strategy = getSessionStrategy(pickSessionStrategyId(backend, sessionStrategy[connection.backendId]));
  return { backend, strategy, connectionKey: connectionKey(connection), connection };
}
