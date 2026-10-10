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
  readonly capabilities: BackendCapabilities;
  readonly onboarding: BackendOnboarding | null;
  readonly defaultSessionStrategy = 'per-day';

  readonly sent: FeedbackSendInput[] = [];
  readonly sessions: SessionRef[] = [];
  readonly createInputs: SessionCreateInput[] = [];

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
    this.sent.push(input);
    return { messageID: `msg_fake_${this.nextID++}` };
  }
}
