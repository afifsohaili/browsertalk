import type { SessionRef } from '@/lib/agent-backend/interface';
import { projectName, type SessionStrategy, type SessionStrategyInput } from './interface';
import { peekStoredSession, resolveStoredSession, rolloverStoredSession, type PersistSessionInput } from './persist';

export function stickyTitle(directory: string): string {
  return `Browsertalk · ${projectName(directory)}`;
}

export class StickySessionStrategy implements SessionStrategy {
  readonly id = 'sticky';
  readonly label = 'Sticky';

  resolveSession(input: SessionStrategyInput): Promise<SessionRef> {
    return resolveStoredSession(this.persistInput(input));
  }

  rolloverSession(input: SessionStrategyInput): Promise<SessionRef> {
    return rolloverStoredSession(this.persistInput(input));
  }

  peekSession(input: SessionStrategyInput): Promise<SessionRef | null> {
    return peekStoredSession(this.persistInput(input));
  }

  private persistInput(input: SessionStrategyInput): PersistSessionInput {
    return {
      backend: input.backend,
      strategyId: this.id,
      strategyKey: input.directory,
      directory: input.directory,
      title: stickyTitle(input.directory),
    };
  }
}
