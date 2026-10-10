import type { AgentBackend, SessionRef } from '@/lib/agent-backend/interface';

export const SESSION_STRATEGY_IDS = ['per-day', 'sticky'] as const;

export type SessionStrategyId = (typeof SESSION_STRATEGY_IDS)[number];

export function isSessionStrategyId(value: unknown): value is SessionStrategyId {
  return typeof value === 'string' && (SESSION_STRATEGY_IDS as readonly string[]).includes(value);
}

export interface SessionStrategyInput {
  backend: AgentBackend;
  directory: string;
  now?: Date;
}

export interface SessionStrategy {
  readonly id: SessionStrategyId;
  readonly label: string;
  resolveSession(input: SessionStrategyInput): Promise<SessionRef>;
  rolloverSession(input: SessionStrategyInput): Promise<SessionRef>;
  peekSession(input: SessionStrategyInput): Promise<SessionRef | null>;
}

export function projectName(directory: string): string {
  const name = directory.replace(/\/+$/, '').split('/').at(-1) ?? '';
  return name.length > 0 ? name : directory;
}
