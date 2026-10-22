import { resolveConfiguredConnection } from '@/lib/connection/resolve';
import {
  CONNECTION_ACTIONS,
  OPENCODE_REQUIRED,
  OPENCODE_UPGRADE_MESSAGE,
  isSupportedOpenCodeVersion,
} from '@/lib/connection/status';
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
import { backendErrorCode } from './interface';
import { OpenCodeApi, OpenCodeError, probeServer, redeemPairingCode, type FetchLike } from './opencode-api';

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
    acceptsPairingLink: true,
    credentialLabel: 'Pairing link or code',
    emptyCredentialError: 'Paste the pairing link or code',
    instructions: () =>
      'Run opencode pair in a terminal. Copy the link. Do not open it. Links expire in 5 minutes. Then paste the link or code.',
    command: () => 'opencode pair',
    authenticate: async (input) => {
      const connection =
        input.endpoint === undefined
          ? await this.resolve()
          : { baseUrl: input.endpoint, allowRemote: input.allowRemote === true };
      const token = await redeemPairingCode({
        baseUrl: connection.baseUrl,
        code: input.credential,
        allowRemote: connection.allowRemote,
        fetchFn: this.config.fetchFn,
      });

      const { version } = await this.api(connection.baseUrl, token, connection.allowRemote).info();
      if (!isSupportedOpenCodeVersion(version)) throw new OpenCodeError(OPENCODE_UPGRADE_MESSAGE);

      return input.endpoint === undefined ? { token } : { token, endpoint: input.endpoint };
    },
  };

  constructor(private readonly config: OpenCodeBackendConfig = {}) {}

  async ping(): Promise<BackendStatus> {
    let baseUrl: string;
    let token: string;
    let allowRemote: boolean;
    try {
      ({ baseUrl, token, allowRemote } = await this.resolve());
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'The connection check failed',
        state: 'unreachable',
        action: 'Fix the server URL in settings',
      };
    }

    if (token.length === 0) return this.probeUnpaired(baseUrl, allowRemote);

    try {
      const { version } = await this.api(baseUrl, token, allowRemote).info();
      return this.classifyVersion(baseUrl, version);
    } catch (error) {
      const rejected = backendErrorCode(error) === 'unauthorized' || (error instanceof OpenCodeError && error.status === 401);
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'The connection check failed',
        state: rejected ? 'unauthorized' : 'unreachable',
        action: rejected ? CONNECTION_ACTIONS.unauthorized : CONNECTION_ACTIONS.unreachable,
        endpoint: baseUrl,
      };
    }
  }

  private async probeUnpaired(baseUrl: string, allowRemote: boolean): Promise<BackendStatus> {
    try {
      const { version } = await probeServer({
        baseUrl,
        allowRemote,
        fetchFn: this.config.fetchFn,
        timeoutMs: this.config.timeoutMs,
      });
      if (!isSupportedOpenCodeVersion(version)) {
        return {
          ok: false,
          detail: OPENCODE_REQUIRED,
          state: 'incompatible',
          action: CONNECTION_ACTIONS.incompatible,
          endpoint: baseUrl,
          version,
        };
      }
      return {
        ok: false,
        detail: NOT_PAIRED,
        state: 'unpaired',
        action: CONNECTION_ACTIONS.unpaired,
        endpoint: baseUrl,
        version,
      };
    } catch (error) {
      // Any HTTP answer means the server is up; only a transport failure is unreachable.
      const answered =
        backendErrorCode(error) === 'unauthorized' || (error instanceof OpenCodeError && error.status !== null);
      return {
        ok: false,
        detail: answered
          ? NOT_PAIRED
          : error instanceof Error
            ? error.message
            : 'The connection check failed',
        state: answered ? 'unpaired' : 'unreachable',
        action: answered ? CONNECTION_ACTIONS.unpaired : CONNECTION_ACTIONS.unreachable,
        endpoint: baseUrl,
      };
    }
  }

  private classifyVersion(baseUrl: string, version: string): BackendStatus {
    if (!isSupportedOpenCodeVersion(version)) {
      return {
        ok: false,
        detail: OPENCODE_REQUIRED,
        state: 'incompatible',
        action: CONNECTION_ACTIONS.incompatible,
        endpoint: baseUrl,
        version,
      };
    }
    return {
      ok: true,
      detail: `opencode ${version}`,
      state: 'connected',
      action: CONNECTION_ACTIONS.connected,
      endpoint: baseUrl,
      version,
    };
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
