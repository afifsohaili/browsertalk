import type {
  AgentBackend,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from './interface';

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:15001';

export interface OpenCodeBackendConfig {
  baseUrl: string;
  token: string;
}

export class OpenCodeBackend implements AgentBackend {
  readonly id = 'opencode';
  readonly label = 'opencode';
  readonly capabilities = { projects: true };

  constructor(public readonly config: OpenCodeBackendConfig) {}

  ping(): Promise<BackendStatus> {
    return this.stub('ping');
  }

  listProjects(): Promise<Project[]> {
    return this.stub('listProjects');
  }

  createSession(_input: SessionCreateInput): Promise<SessionRef> {
    return this.stub('createSession');
  }

  sendFeedback(_input: FeedbackSendInput): Promise<SendResult> {
    return this.stub('sendFeedback');
  }

  private stub(method: string): never {
    throw new Error(
      `OpenCodeBackend.${method} is not implemented yet (phase 1) — server ${this.config.baseUrl}`,
    );
  }
}
