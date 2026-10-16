import type { SessionStrategyId } from '@/lib/session-strategy/interface';

export type AgentBackendId = string;

export function isAgentBackendId(value: unknown): value is AgentBackendId {
  return typeof value === 'string' && value.length > 0;
}

export type DeliveryMode = 'queue' | 'steer';

export interface BackendCapabilities {
  /** The backend can list known project directories. */
  projects: boolean;
  /** The backend applies the requested title when creating a session. */
  namedCreation: boolean;
  /** Delivery modes the backend accepts in sendFeedback. */
  delivery: readonly DeliveryMode[];
  /** Feedback attachments may carry images (data URLs). */
  images: boolean;
}

export interface BackendConnectionConfig {
  baseUrl: string;
  token: string | null;
  /** The "Allow a remote server" policy from settings; adapters pass it to their transport. */
  allowRemote?: boolean;
}

export interface BackendStatus {
  ok: boolean;
  detail: string;
}

export interface OnboardingInstructionsInput {
  endpoint: string;
}

export interface BackendCredentialInput {
  credential: string;
}

export interface BackendCredentialResult {
  /** Token to persist for the connection; null when nothing is stored. */
  token: string | null;
}

export interface BackendOnboarding {
  /** Input placeholder for the credential, e.g. "Pairing code". */
  readonly credentialLabel: string;
  /** Error shown when the credential field is submitted empty. */
  readonly emptyCredentialError: string;
  /** User-facing line describing how to obtain the credential. */
  instructions(input: OnboardingInstructionsInput): string;
  /** Command the user may need to run; null when there is none. */
  command(input: OnboardingInstructionsInput): string | null;
  /** Exchange the entered credential for a token to persist. */
  authenticate(input: BackendCredentialInput): Promise<BackendCredentialResult>;
}

export interface Project {
  id: string;
  name: string;
  directory: string;
}

export function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; name?: unknown; directory?: unknown };
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.name === 'string' &&
    typeof candidate.directory === 'string' &&
    candidate.directory.length > 0
  );
}

export interface SessionCreationIntent {
  /** Strategy that owns this session slot, e.g. "per-day". */
  strategyId: SessionStrategyId;
  /** Stable slot key inside the strategy, e.g. "/dir::2026-10-10". */
  strategyKey: string;
  /** 0 for a first creation; one higher per deliberate rollover. */
  generation: number;
}

export interface SessionCreateInput {
  directory: string;
  title: string;
  intent: SessionCreationIntent;
}

export interface SessionRef {
  id: string;
  title: string;
}

export interface SessionListQuery {
  directory?: string;
  search?: string;
  /** Only root sessions: child/subagent sessions are excluded. */
  rootsOnly?: boolean;
}

export interface FeedbackAttachment {
  uri: string;
  name?: string;
  description?: string;
}

export interface FeedbackSendInput {
  sessionID: string;
  text: string;
  delivery: DeliveryMode;
  /** Stable client request id: retries reuse it so an admitting backend can deduplicate. */
  requestID: string;
  files?: FeedbackAttachment[];
}

export interface SendResult {
  /** True when the backend confirmed durable admission; sendFeedback only resolves on admission. */
  admitted: true;
  /** Backend-assigned message id, when the backend exposes one. */
  messageID: string | null;
}

export const BACKEND_ERROR_CODES = ['unauthorized', 'missing-session', 'busy', 'ambiguous-admission'] as const;

export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

export class BackendError extends Error {
  readonly code: BackendErrorCode;

  constructor(code: BackendErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'BackendError';
    this.code = code;
  }
}

export function backendErrorCode(error: unknown): BackendErrorCode | null {
  return error instanceof BackendError ? error.code : null;
}

export interface AgentBackend {
  readonly id: AgentBackendId;
  readonly label: string;
  readonly capabilities: BackendCapabilities;
  readonly defaultSessionStrategy: SessionStrategyId;
  /** How the user connects this backend; null when it needs no credential. */
  readonly onboarding: BackendOnboarding | null;
  ping(): Promise<BackendStatus>;
  listProjects(): Promise<Project[]>;
  createSession(input: SessionCreateInput): Promise<SessionRef>;
  /** Resolves when the backend durably admitted the feedback; never waits for the agent turn to finish. */
  sendFeedback(input: FeedbackSendInput): Promise<SendResult>;
  /** Optional: read one session's current server-side state; null when it no longer exists. */
  getSession?(sessionID: string): Promise<SessionRef | null>;
  /** Optional: list session refs the backend knows, newest first. */
  listSessions?(query: SessionListQuery): Promise<SessionRef[]>;
}
