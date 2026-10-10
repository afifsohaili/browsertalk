import type { SessionStrategy, SessionStrategyId } from './interface';

export type SessionStrategyFactory = () => SessionStrategy;

const factories = new Map<SessionStrategyId, SessionStrategyFactory>();

export function registerSessionStrategy(id: SessionStrategyId, factory: SessionStrategyFactory): void {
  if (factories.has(id)) {
    throw new Error(`Session strategy "${id}" is already registered`);
  }
  factories.set(id, factory);
}

export function getSessionStrategy(id: string): SessionStrategy {
  const factory = factories.get(id as SessionStrategyId);
  if (!factory) {
    const known = [...factories.keys()].join(', ') || 'none';
    throw new Error(`Session strategy "${id}" is not registered. Registered strategies: ${known}`);
  }
  return factory();
}

export function listSessionStrategies(): SessionStrategyId[] {
  return [...factories.keys()];
}
