import type { AgentBackend, SessionRef } from '@/lib/agent-backend/interface';
import { getStoredSession, setStoredSession } from '@/lib/storage/sessions';
import type { SessionStrategyId } from './interface';

export interface PersistSessionInput {
  backend: AgentBackend;
  connectionKey: string;
  strategyId: SessionStrategyId;
  strategyKey: string;
  directory: string;
  title: string;
}

export async function resolveStoredSession(input: PersistSessionInput): Promise<SessionRef> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  if (stored !== null) return { id: stored.sessionID, title: stored.title };
  return createStoredSession(input);
}

export async function peekStoredSession(input: PersistSessionInput): Promise<SessionRef | null> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  return stored === null ? null : { id: stored.sessionID, title: stored.title };
}

export function rolloverStoredSession(input: PersistSessionInput): Promise<SessionRef> {
  return createStoredSession(input);
}

async function createStoredSession(input: PersistSessionInput): Promise<SessionRef> {
  const session = await input.backend.createSession({ directory: input.directory, title: input.title });
  await setStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
    sessionID: session.id,
    title: session.title,
  });
  return session;
}
