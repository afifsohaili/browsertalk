import type { SessionRef } from '@/lib/agent-backend/interface';
import { projectName, type SessionStrategy, type SessionStrategyInput } from './interface';
import { peekStoredSession, resolveStoredSession, rolloverStoredSession, type PersistSessionInput } from './persist';

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function perDayTitle(directory: string, date: Date): string {
  return `Browsertalk · ${projectName(directory)} · ${localDateKey(date)}`;
}

export class PerDaySessionStrategy implements SessionStrategy {
  readonly id = 'per-day';
  readonly label = 'Per-day';

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
    const now = input.now ?? new Date();
    return {
      backend: input.backend,
      strategyId: this.id,
      strategyKey: `${input.directory}::${localDateKey(now)}`,
      directory: input.directory,
      title: perDayTitle(input.directory, now),
    };
  }
}
