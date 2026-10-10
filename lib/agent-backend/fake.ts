import type {
  AgentBackend,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from './interface';

export class FakeAgentBackend implements AgentBackend {
  readonly id = 'fake';
  readonly label = 'Fake';
  readonly capabilities = { projects: true };
  readonly defaultSessionStrategy = 'per-day';

  readonly sent: FeedbackSendInput[] = [];
  readonly sessions: SessionRef[] = [];
  readonly createInputs: SessionCreateInput[] = [];

  private nextID = 1;

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
