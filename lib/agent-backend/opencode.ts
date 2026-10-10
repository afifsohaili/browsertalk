import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import type {
  AgentBackend,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from './interface';
import { OpenCodeApi, OpenCodeError, type FetchLike } from './opencode-api';

export interface OpenCodeBackendConfig {
  baseUrl?: string;
  token?: string | null;
  fetchFn?: FetchLike;
}

export const NOT_PAIRED = 'Not paired';

export class OpenCodeBackend implements AgentBackend {
  readonly id = 'opencode';
  readonly label = 'opencode';
  readonly capabilities = { projects: true };
  readonly defaultSessionStrategy = 'per-day';

  constructor(private readonly config: OpenCodeBackendConfig = {}) {}

  async ping(): Promise<BackendStatus> {
    try {
      const { baseUrl, token } = await this.resolve();
      if (token.length === 0) return { ok: false, detail: NOT_PAIRED };

      const { version } = await this.api(baseUrl, token).info();
      return { ok: true, detail: `opencode ${version}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'The connection check failed' };
    }
  }

  async listProjects(): Promise<Project[]> {
    const { baseUrl, token } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token).listProjects();
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    const { baseUrl, token } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token).createSession(input);
  }

  async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const { baseUrl, token } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token).sendPrompt(input);
  }

  private api(baseUrl: string, token: string): OpenCodeApi {
    return new OpenCodeApi({ baseUrl, token, fetchFn: this.config.fetchFn });
  }

  private async resolve(): Promise<{ baseUrl: string; token: string }> {
    if (this.config.baseUrl !== undefined) {
      return { baseUrl: this.config.baseUrl, token: this.config.token ?? '' };
    }

    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) throw new OpenCodeError(resolved.error);
    return { baseUrl: resolved.connection.endpoint, token: resolved.connection.token ?? '' };
  }
}
