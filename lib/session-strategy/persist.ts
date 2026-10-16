import type { AgentBackend, SessionRef } from '@/lib/agent-backend/interface';
import { getStoredSession } from '@/lib/storage/sessions';
import { writeStoredSession } from '@/lib/storage/writer';
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
  if (stored === null) return null;
  const known = { id: stored.sessionID, title: stored.title };
  try {
    return await refreshExistingSession(input, known, stored.generation);
  } catch {
    // Display-only peek: keep the last known ref when the server is unreachable; sends still surface the failure.
    return known;
  }
}

export async function rolloverStoredSession(input: PersistSessionInput): Promise<SessionRef> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  return createStoredSession(input, (stored?.generation ?? 0) + 1);
}

export async function adoptStoredSession(input: PersistSessionInput, session: SessionRef): Promise<SessionRef> {
  const stored = await getStoredSession(input.connectionKey, input.strategyId, input.strategyKey);
  await writeStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
    sessionID: session.id,
    title: session.title,
    generation: stored?.generation ?? 0,
  });
  return session;
}

async function refreshStoredSession(
  input: PersistSessionInput,
  session: SessionRef,
  generation: number,
): Promise<SessionRef> {
  const current = await refreshExistingSession(input, session, generation);
  if (current === null) return createStoredSession(input, generation + 1);
  return current;
}

async function refreshExistingSession(
  input: PersistSessionInput,
  session: SessionRef,
  generation: number,
): Promise<SessionRef | null> {
  const getSession = input.backend.getSession;
  if (getSession === undefined) return session;

  const current = await getSession.call(input.backend, session.id);
  if (current === null) return null;
  if (current.title !== session.title) {
    await writeStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
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
  await writeStoredSession(input.connectionKey, input.strategyId, input.strategyKey, {
    sessionID: session.id,
    title: session.title,
    generation,
  });
  return session;
}
