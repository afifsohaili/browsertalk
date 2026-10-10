import { beforeAll, describe, expect, it } from 'vitest';
import type {
  AgentBackend,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from './interface';
import { getAgentBackend, hasAgentBackend, listAgentBackends, registerAgentBackend } from './registry';

class StubBackend implements AgentBackend {
  readonly id: string;
  readonly label = 'Stub';
  readonly capabilities = { projects: false, namedCreation: true, delivery: ['queue'] as const, images: false };
  readonly defaultSessionStrategy = 'per-day';
  readonly onboarding = null;

  constructor(id: string) {
    this.id = id;
  }

  async ping(): Promise<BackendStatus> {
    return { ok: true, detail: 'stub' };
  }

  async listProjects(): Promise<Project[]> {
    return [];
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    return { id: input.intent.strategyKey, title: input.title };
  }

  async sendFeedback(): Promise<SendResult> {
    return { messageID: null };
  }
}

beforeAll(() => {
  registerAgentBackend('stub-one', () => new StubBackend('stub-one'));
});

describe('agent backend registry', () => {
  it('accepts any adapter id without editing a hardcoded union', () => {
    registerAgentBackend('stub-four', () => new StubBackend('stub-four'));

    expect(listAgentBackends()).toEqual(['stub-one', 'stub-four']);
    expect(hasAgentBackend('stub-four')).toBe(true);
    expect(getAgentBackend('stub-four').id).toBe('stub-four');
  });

  it('reports unknown ids and fails fast with the known list', () => {
    expect(hasAgentBackend('missing')).toBe(false);
    expect(() => getAgentBackend('missing')).toThrow('Agent backend "missing" is not registered');
  });

  it('refuses a duplicate registration', () => {
    expect(() => registerAgentBackend('stub-one', () => new StubBackend('stub-one'))).toThrow(
      'Agent backend "stub-one" is already registered',
    );
  });
});
