import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import type {
  AgentBackend,
  BackendCapabilities,
  BackendOnboarding,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionListQuery,
  SessionRef,
} from './interface';
import { OpenCodeApi, OpenCodeError, redeemPairingCode, type FetchLike } from './opencode-api';

export interface OpenCodeBackendConfig {
  baseUrl?: string;
  token?: string | null;
  allowRemote?: boolean;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export const NOT_PAIRED = 'Not paired';

export class OpenCodeBackend implements AgentBackend {
  readonly id = 'opencode';
  readonly label = 'opencode';
  readonly capabilities: BackendCapabilities = {
    projects: true,
    namedCreation: true,
    delivery: ['queue', 'steer'],
    images: true,
  };
  readonly defaultSessionStrategy = 'per-day';
  readonly onboarding: BackendOnboarding = {
    credentialLabel: 'Pairing code',
    emptyCredentialError: 'Enter a pairing code',
    instructions: () => 'Run this on the server, then paste the code:',
    command: ({ endpoint }) => `opencode api post /api/pair --server ${endpoint}`,
    authenticate: async (input) => {
      const { baseUrl, allowRemote } = await this.resolve();
      const token = await redeemPairingCode({
        baseUrl,
        code: input.credential,
        allowRemote,
        fetchFn: this.config.fetchFn,
      });
      return { token };
    },
  };

  constructor(private readonly config: OpenCodeBackendConfig = {}) {}

  async ping(): Promise<BackendStatus> {
    try {
      const { baseUrl, token, allowRemote } = await this.resolve();
      if (token.length === 0) return { ok: false, detail: NOT_PAIRED };

      const { version } = await this.api(baseUrl, token, allowRemote).info();
      return { ok: true, detail: `opencode ${version}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'The connection check failed' };
    }
  }

  async listProjects(): Promise<Project[]> {
    const { baseUrl, token, allowRemote } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token, allowRemote).listProjects();
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    const { baseUrl, token, allowRemote } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token, allowRemote).createSession(input);
  }

  async listSessions(query: SessionListQuery): Promise<SessionRef[]> {
    const { baseUrl, token, allowRemote } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token, allowRemote).listSessions(query);
  }

  async getSession(sessionID: string): Promise<SessionRef | null> {
    const { baseUrl, token, allowRemote } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token, allowRemote).getSession(sessionID);
  }

  async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const { baseUrl, token, allowRemote } = await this.resolve();
    if (token.length === 0) throw new OpenCodeError(NOT_PAIRED);
    return this.api(baseUrl, token, allowRemote).sendPrompt(input);
  }

  private api(baseUrl: string, token: string, allowRemote: boolean): OpenCodeApi {
    return new OpenCodeApi({
      baseUrl,
      token,
      allowRemote,
      fetchFn: this.config.fetchFn,
      timeoutMs: this.config.timeoutMs,
    });
  }

  private async resolve(): Promise<{ baseUrl: string; token: string; allowRemote: boolean }> {
    if (this.config.baseUrl !== undefined) {
      return {
        baseUrl: this.config.baseUrl,
        token: this.config.token ?? '',
        allowRemote: this.config.allowRemote === true,
      };
    }

    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) throw new OpenCodeError(resolved.error);
    return {
      baseUrl: resolved.connection.endpoint,
      token: resolved.connection.token ?? '',
      allowRemote: resolved.connection.allowRemote,
    };
  }
}
