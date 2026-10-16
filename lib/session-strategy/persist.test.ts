import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FakeAgentBackend } from '@/lib/agent-backend/fake';
import type { AgentBackend, SessionCreateInput, SessionRef } from '@/lib/agent-backend/interface';
import { getStoredSession } from '@/lib/storage/sessions';
import { writeStoredSession } from '@/lib/storage/writer';
import {
  adoptStoredSession,
  peekStoredSession,
  resolveStoredSession,
  rolloverStoredSession,
  type PersistSessionInput,
} from './persist';

const CONNECTION = 'fake@http://127.0.0.1:15001';
const DIRECTORY = '/home/afif/example';
const KEY = `${DIRECTORY}::2026-10-10`;
const TITLE = 'Browsertalk · example · 2026-10-10';

class FailingCreateBackend extends FakeAgentBackend {
  failNextCreate = false;

  override async createSession(input: SessionCreateInput): Promise<SessionRef> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      this.createInputs.push(input);
      throw new Error('create failed');
    }
    return super.createSession(input);
  }
}

class RefreshingBackend extends FakeAgentBackend {
  readonly removed = new Set<string>();

  async getSession(sessionID: string): Promise<SessionRef | null> {
    if (this.removed.has(sessionID)) return null;
    return this.sessions.find((session) => session.id === sessionID) ?? null;
  }
}

class UnreachableRefreshBackend extends FakeAgentBackend {
  async getSession(): Promise<SessionRef | null> {
    throw new Error('Cannot reach the opencode server');
  }
}

function persistInput(backend: AgentBackend): PersistSessionInput {
  return {
    backend,
    connectionKey: CONNECTION,
    strategyId: 'per-day',
    strategyKey: KEY,
    directory: DIRECTORY,
    title: TITLE,
  };
}

describe('session persistence', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('passes a stable creation intent on the first creation', async () => {
    const backend = new FakeAgentBackend();

    const session = await resolveStoredSession(persistInput(backend));

    expect(session).toEqual({ id: 'ses_fake_1', title: TITLE });
    expect(backend.createInputs).toEqual([
      {
        directory: DIRECTORY,
        title: TITLE,
        intent: { strategyId: 'per-day', strategyKey: KEY, generation: 0 },
      },
    ]);
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: 'ses_fake_1',
      title: TITLE,
      generation: 0,
    });
  });

  it('reuses the stored session without creating again', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    const first = await resolveStoredSession(input);
    const second = await resolveStoredSession(input);

    expect(second).toEqual(first);
    expect(backend.createInputs).toHaveLength(1);
    expect(await peekStoredSession(input)).toEqual(first);
  });

  it('reuses the same creation intent when a creation retries', async () => {
    const backend = new FailingCreateBackend();
    const input = persistInput(backend);

    backend.failNextCreate = true;
    await expect(resolveStoredSession(input)).rejects.toThrow('create failed');
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toBeNull();

    const session = await resolveStoredSession(input);

    expect(session).toEqual({ id: 'ses_fake_1', title: TITLE });
    expect(backend.createInputs).toHaveLength(2);
    expect(backend.createInputs[0]?.intent).toEqual({
      strategyId: 'per-day',
      strategyKey: KEY,
      generation: 0,
    });
    expect(backend.createInputs[1]?.intent).toEqual(backend.createInputs[0]?.intent);
  });

  it('bumps the generation on a deliberate rollover', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    const first = await resolveStoredSession(input);
    const fresh = await rolloverStoredSession(input);

    expect(fresh.id).not.toBe(first.id);
    expect(backend.createInputs[1]?.intent).toEqual({
      strategyId: 'per-day',
      strategyKey: KEY,
      generation: 1,
    });
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: fresh.id,
      title: fresh.title,
      generation: 1,
    });

    const next = await resolveStoredSession(input);
    expect(next).toEqual(fresh);
  });

  it('reuses the same generation when a rollover retries', async () => {
    const backend = new FailingCreateBackend();
    const input = persistInput(backend);

    await resolveStoredSession(input);

    backend.failNextCreate = true;
    await expect(rolloverStoredSession(input)).rejects.toThrow('create failed');

    const fresh = await rolloverStoredSession(input);

    expect(backend.createInputs).toHaveLength(3);
    expect(backend.createInputs[1]?.intent.generation).toBe(1);
    expect(backend.createInputs[2]?.intent).toEqual(backend.createInputs[1]?.intent);
    expect(backend.createInputs[2]?.intent.strategyKey).toBe(KEY);
    expect(fresh.title).toBe(TITLE);
  });

  it('refreshes a renamed session title and keeps its generation', async () => {
    const backend = new RefreshingBackend();
    const input = persistInput(backend);

    const created = await resolveStoredSession(input);
    const stored = backend.sessions[0];
    if (stored === undefined) throw new Error('expected a created session');
    stored.title = 'Renamed in the TUI';

    const reused = await resolveStoredSession(input);

    expect(reused).toEqual({ id: created.id, title: 'Renamed in the TUI' });
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: created.id,
      title: 'Renamed in the TUI',
      generation: 0,
    });
  });

  it('recreates a session the backend no longer has, with the next generation', async () => {
    const backend = new RefreshingBackend();
    const input = persistInput(backend);

    const created = await resolveStoredSession(input);
    backend.removed.add(created.id);

    const recreated = await resolveStoredSession(input);

    expect(recreated.id).not.toBe(created.id);
    expect(backend.createInputs[1]?.intent).toEqual({
      strategyId: 'per-day',
      strategyKey: KEY,
      generation: 1,
    });
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: recreated.id,
      title: recreated.title,
      generation: 1,
    });
  });

  it('keeps a stored title when the backend cannot refresh sessions', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    const created = await resolveStoredSession(input);
    await writeStoredSession(CONNECTION, 'per-day', KEY, {
      sessionID: created.id,
      title: 'My review thread',
      generation: 0,
    });

    await expect(resolveStoredSession(input)).resolves.toEqual({
      id: created.id,
      title: 'My review thread',
    });
  });

  it('adopts a picked session into the slot and keeps the generation', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    await resolveStoredSession(input);
    const adopted = await adoptStoredSession(input, { id: 'ses_else', title: 'My review thread' });

    expect(adopted).toEqual({ id: 'ses_else', title: 'My review thread' });
    expect(backend.createInputs).toHaveLength(1);
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: 'ses_else',
      title: 'My review thread',
      generation: 0,
    });
  });

  it('adopts into an empty slot at generation zero', async () => {
    const backend = new FakeAgentBackend();

    await adoptStoredSession(persistInput(backend), { id: 'ses_else', title: 'T' });

    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: 'ses_else',
      title: 'T',
      generation: 0,
    });
    expect(backend.createInputs).toEqual([]);
  });

  it('keeps a bumped generation across an adoption', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    await resolveStoredSession(input);
    await rolloverStoredSession(input);
    await adoptStoredSession(input, { id: 'ses_else', title: 'T' });
    await rolloverStoredSession(input);

    expect(backend.createInputs[2]?.intent.generation).toBe(2);
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: 'ses_fake_3',
      title: TITLE,
      generation: 2,
    });
  });

  it('continues on the adopted session for later feedback', async () => {
    const backend = new FakeAgentBackend();
    const input = persistInput(backend);

    await resolveStoredSession(input);
    await adoptStoredSession(input, { id: 'ses_else', title: 'My review thread' });

    await expect(resolveStoredSession(input)).resolves.toEqual({ id: 'ses_else', title: 'My review thread' });
    expect(backend.createInputs).toHaveLength(1);
  });

  it('peeks a renamed session title through the backend and writes it back', async () => {
    const backend = new RefreshingBackend();
    const input = persistInput(backend);

    const created = await resolveStoredSession(input);
    const stored = backend.sessions[0];
    if (stored === undefined) throw new Error('expected a created session');
    stored.title = 'Renamed in the TUI';

    await expect(peekStoredSession(input)).resolves.toEqual({ id: created.id, title: 'Renamed in the TUI' });
    expect(await getStoredSession(CONNECTION, 'per-day', KEY)).toEqual({
      sessionID: created.id,
      title: 'Renamed in the TUI',
      generation: 0,
    });
  });

  it('peeks null for a session the backend no longer has, without creating one', async () => {
    const backend = new RefreshingBackend();
    const input = persistInput(backend);

    const created = await resolveStoredSession(input);
    backend.removed.add(created.id);

    await expect(peekStoredSession(input)).resolves.toBeNull();
    expect(backend.createInputs).toHaveLength(1);
  });

  it('peeks the stored ref when the refresh fails, without inventing a new one', async () => {
    const backend = new UnreachableRefreshBackend();
    await writeStoredSession(CONNECTION, 'per-day', KEY, {
      sessionID: 'ses_known',
      title: 'My review thread',
      generation: 0,
    });

    await expect(peekStoredSession(persistInput(backend))).resolves.toEqual({
      id: 'ses_known',
      title: 'My review thread',
    });
    expect(backend.createInputs).toEqual([]);
  });
});
