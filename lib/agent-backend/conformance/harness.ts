import type { AgentBackend, BackendConnectionConfig, SessionListQuery, SessionRef } from '../interface';
import type { AdapterConformanceCase, ConformanceSeamRecord, TransportCall } from './types';

export const CONFORMANCE_ENDPOINT = 'http://127.0.0.1:15001';

class RecordingAgentBackend implements AgentBackend {
  readonly getSession?: (sessionID: string) => Promise<SessionRef | null>;
  readonly listSessions?: (query: SessionListQuery) => Promise<SessionRef[]>;

  constructor(
    private readonly inner: AgentBackend,
    private readonly record: ConformanceSeamRecord,
  ) {
    if (inner.getSession !== undefined) {
      this.getSession = (sessionID) => inner.getSession!.call(inner, sessionID);
    }
    if (inner.listSessions !== undefined) {
      this.listSessions = (query) => inner.listSessions!.call(inner, query);
    }
  }

  get id() {
    return this.inner.id;
  }

  get label() {
    return this.inner.label;
  }

  get capabilities() {
    return this.inner.capabilities;
  }

  get defaultSessionStrategy() {
    return this.inner.defaultSessionStrategy;
  }

  get onboarding() {
    return this.inner.onboarding;
  }

  ping() {
    this.record.pingCalls += 1;
    return this.inner.ping();
  }

  listProjects() {
    this.record.listProjectsCalls += 1;
    return this.inner.listProjects();
  }

  createSession(input: Parameters<AgentBackend['createSession']>[0]) {
    this.record.creates.push(input);
    return this.inner.createSession(input);
  }

  async sendFeedback(input: Parameters<AgentBackend['sendFeedback']>[0]) {
    this.record.sends.push(input);
    const result = await this.inner.sendFeedback(input);
    this.record.admitted.push(input);
    return result;
  }
}

export class ConformanceHarness {
  readonly seam: ConformanceSeamRecord = {
    creates: [],
    sends: [],
    admitted: [],
    listProjectsCalls: 0,
    pingCalls: 0,
  };

  constructor(readonly adapter: AdapterConformanceCase) {}

  reset(): void {
    this.adapter.reset();
    this.seam.creates.length = 0;
    this.seam.sends.length = 0;
    this.seam.admitted.length = 0;
    this.seam.listProjectsCalls = 0;
    this.seam.pingCalls = 0;
  }

  backend(config?: BackendConnectionConfig): AgentBackend {
    const resolved = config ?? { baseUrl: CONFORMANCE_ENDPOINT, token: this.adapter.token };
    return new RecordingAgentBackend(this.adapter.create(resolved), this.seam);
  }

  transport(): readonly TransportCall[] {
    return this.adapter.transport();
  }
}
