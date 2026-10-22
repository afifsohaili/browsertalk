import type {
  AgentBackend,
  BackendCapabilities,
  BackendOnboarding,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from './interface';

const DEFAULT_CAPABILITIES: BackendCapabilities = {
  projects: true,
  namedCreation: true,
  delivery: ['queue', 'steer'],
  images: true,
};

export interface FakeAgentBackendOptions {
  capabilities?: BackendCapabilities;
  onboarding?: BackendOnboarding | null;
}

export class FakeAgentBackend implements AgentBackend {
  readonly id = 'fake';
  readonly label = 'Fake';
  readonly userSelectable = false;
  readonly capabilities: BackendCapabilities;
  readonly onboarding: BackendOnboarding | null;
  readonly defaultSessionStrategy = 'per-day';

  readonly sent: FeedbackSendInput[] = [];
  readonly feedbackCalls: FeedbackSendInput[] = [];
  readonly sessions: SessionRef[] = [];
  readonly createInputs: SessionCreateInput[] = [];

  private readonly admissions = new Map<string, SendResult>();
  private nextID = 1;

  constructor(options: FakeAgentBackendOptions = {}) {
    this.capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;
    this.onboarding = options.onboarding ?? null;
  }

  async ping(): Promise<BackendStatus> {
    return { ok: true, detail: 'fake backend' };
  }

  async listProjects(): Promise<Project[]> {
    return [{ id: 'proj_fake', name: 'fake-project', directory: '/tmp/fake-project' }];
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    const session = { id: `ses_fake_${this.nextID++}`, title: input.title };
    this.createInputs.push(input);
    this.sessions.push(session);
    return session;
  }

  async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    this.feedbackCalls.push(input);

    const admitted = this.admissions.get(input.requestID);
    if (admitted !== undefined) return admitted;

    const result: SendResult = { admitted: true, messageID: `msg_fake_${this.nextID++}` };
    this.admissions.set(input.requestID, result);
    this.sent.push(input);
    return result;
  }
}
