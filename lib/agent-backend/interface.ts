export type AgentBackendId = 'opencode' | 'pi' | 'fake';

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
  ping(): Promise<BackendStatus>;
  listProjects(): Promise<Project[]>;
  createSession(input: SessionCreateInput): Promise<SessionRef>;
  sendFeedback(input: FeedbackSendInput): Promise<SendResult>;
}
