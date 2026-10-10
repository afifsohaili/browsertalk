import type { AgentBackend } from '@/lib/agent-backend/interface';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { getSettings } from '@/lib/storage/settings';
import { isSessionStrategyId, type SessionStrategy, type SessionStrategyId } from './interface';
import { getSessionStrategy } from './registry';

export interface ActiveSessionStrategy {
  backend: AgentBackend;
  strategy: SessionStrategy;
}

export function pickSessionStrategyId(backend: AgentBackend, override: unknown): SessionStrategyId {
  return isSessionStrategyId(override) ? override : backend.defaultSessionStrategy;
}

export async function resolveActiveSessionStrategy(): Promise<ActiveSessionStrategy> {
  const { backendId, sessionStrategy } = await getSettings();
  const backend = getAgentBackend(backendId);
  const strategy = getSessionStrategy(pickSessionStrategyId(backend, sessionStrategy[backendId]));
  return { backend, strategy };
}
