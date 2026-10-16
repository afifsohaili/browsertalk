import type {
  AgentBackend,
  AgentBackendId,
  BackendCapabilities,
  BackendConnectionConfig,
  FeedbackSendInput,
  SessionCreateInput,
} from '../interface';

export interface ConformanceSeamRecord {
  creates: SessionCreateInput[];
  sends: FeedbackSendInput[];
  admitted: FeedbackSendInput[];
  listProjectsCalls: number;
  pingCalls: number;
}

export type TransportOperation = 'ping' | 'list-projects' | 'pair' | 'create' | 'get-session' | 'send';

export interface TransportCall {
  operation: TransportOperation;
  endpoint: string;
  credential: string | null;
  redirect?: string;
  sessionID?: string;
  title?: string;
  requestID?: string;
  delivery?: string;
  attachmentURIs?: string[];
  admitted?: boolean;
}

export interface TurnDeferral {
  turnRunning(): boolean;
  release(): void;
}

export interface ConformanceScenarios {
  rejectAuth?(): void;
  rejectNextSend?(kind: 'busy' | 'missing-session' | 'plain'): void;
  loseNextAdmissionReceipt?(): void;
  deferTurnCompletion?(): TurnDeferral;
  admitWithoutMessageID?(): void;
}

export interface AdapterConformanceCase {
  readonly id: AgentBackendId;
  readonly label: string;
  readonly capabilities: BackendCapabilities;
  readonly deterministicIds: boolean;
  readonly transportSecurity: boolean;
  readonly deferTurn: boolean;
  readonly admitsWithoutMessageID: boolean;
  readonly rejectsConflictingReuse: boolean;
  readonly deliveryMapping: { readonly queue: string; readonly steer: string };
  readonly token: string | null;
  readonly pairing: { readonly credential: string; readonly wrongCredential: string } | null;
  readonly credentialHeader: ((token: string) => string) | null;
  create(config?: BackendConnectionConfig): AgentBackend;
  transport(): readonly TransportCall[];
  admissions(): number;
  reset(): void;
  readonly scenarios: ConformanceScenarios;
}
