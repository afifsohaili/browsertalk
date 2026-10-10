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
  if (stored === null) return createStoredSession(input, 0);
  return refreshStoredSession(input, { id: stored.sessionID, title: stored.title }, stored.generation);
}

export async function peekStoredSession(input: PersistSessionInput): Promise<SessionRef | null> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  return stored === null ? null : { id: stored.sessionID, title: stored.title };
}

export async function rolloverStoredSession(input: PersistSessionInput): Promise<SessionRef> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  return createStoredSession(input, (stored?.generation ?? 0) + 1);
}

async function refreshStoredSession(
  input: PersistSessionInput,
  session: SessionRef,
  generation: number,
): Promise<SessionRef> {
  const getSession = input.backend.getSession;
  if (getSession === undefined) return session;

  const current = await getSession.call(input.backend, session.id);
  if (current === null) return createStoredSession(input, generation + 1);
  if (current.title !== session.title) {
    await setStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
      sessionID: current.id,
      title: current.title,
      generation,
    });
  }
  return current;
}

async function createStoredSession(input: PersistSessionInput, generation: number): Promise<SessionRef> {
  const session = await input.backend.createSession({
    directory: input.directory,
    title: input.title,
    intent: { strategyId: input.strategyId, strategyKey: input.strategyKey, generation },
  });
  await setStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
    sessionID: session.id,
    title: session.title,
    generation,
  });
  return session;
}
