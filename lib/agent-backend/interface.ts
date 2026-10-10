import type { SessionStrategyId } from '@/lib/session-strategy/interface';

export const AGENT_BACKEND_IDS = ['opencode', 'pi', 'fake'] as const;

export type AgentBackendId = (typeof AGENT_BACKEND_IDS)[number];

export function isAgentBackendId(value: unknown): value is AgentBackendId {
  return typeof value === 'string' && (AGENT_BACKEND_IDS as readonly string[]).includes(value);
}

export type DeliveryMode = 'queue' | 'steer';

export interface BackendCapabilities {
  projects: boolean;
}

export interface BackendStatus {
  ok: boolean;
  detail: string;
}

export interface Project {
  id: string;
  name: string;
  directory: string;
}

export interface SessionCreateInput {
  directory: string;
  title: string;
}

export interface SessionRef {
  id: string;
  title: string;
}

export interface FeedbackSendInput {
  sessionID: string;
  text: string;
  delivery: DeliveryMode;
}

export interface SendResult {
  messageID: string | null;
}

export interface AgentBackend {
  readonly id: AgentBackendId;
  readonly label: string;
  readonly capabilities: BackendCapabilities;
  readonly defaultSessionStrategy: SessionStrategyId;
  ping(): Promise<BackendStatus>;
  listProjects(): Promise<Project[]>;
  createSession(input: SessionCreateInput): Promise<SessionRef>;
  sendFeedback(input: FeedbackSendInput): Promise<SendResult>;
}
