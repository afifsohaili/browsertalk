import { parseServerUrl } from '@/lib/connection/endpoint';
import { BackendError, type AgentBackend } from '../interface';
import type {
  BackendCapabilities,
  BackendOnboarding,
  BackendStatus,
  FeedbackSendInput,
  Project,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from '../interface';
import type { FetchLike } from '../opencode-api';
import type { TransportCall } from './types';
import { headersOf, jsonResponse, readJsonBody, redirectOf } from './wire';

export const PI_FIXTURE_TOKEN = 'pi-bridge-token';
export const PI_FIXTURE_PAIRING_SECRET = 'PI-PAIR';

export const PI_FIXTURE_TIMEOUT_MS = 15_000;

function munge(value: string): string {
  const munged = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return munged.length > 0 ? munged : 'root';
}

export interface PiSessionIntent {
  strategyKey: string;
  generation: number;
}

export function piSessionID(directory: string, intent: PiSessionIntent): string {
  return `pi.${munge(directory)}.${munge(intent.strategyKey)}.g${intent.generation}`;
}

export class PiFixtureBridge {
  readonly calls: TransportCall[] = [];
  readonly token = PI_FIXTURE_TOKEN;
  readonly pairingSecret = PI_FIXTURE_PAIRING_SECRET;
  rejectAuth = false;
  rejectNextSend: 'busy' | 'missing-session' | 'plain' | null = null;
  loseNextReceipt = false;
  turnRunning = false;
  admitWithoutMessageID = false;

  private readonly sessions = new Map<string, string>();
  private readonly admitted = new Map<string, string>();
  private readonly admittedInputs = new Map<string, string>();

  get admissionCount(): number {
    return this.admitted.size;
  }

  startTurn(): void {
    this.turnRunning = true;
  }

  releaseTurn(): void {
    this.turnRunning = false;
  }

  readonly fetch: FetchLike = (input, init) => Promise.resolve(this.handle(String(input), init));

  private handle(url: string, init?: RequestInit): Response {
    const parsed = new URL(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const credential = headersOf(init).Authorization ?? null;
    const redirect = redirectOf(init);

    if (parsed.pathname === '/api/pair' && method === 'POST') {
      this.calls.push({ operation: 'pair', endpoint: parsed.origin, credential, redirect });
      const body = readJsonBody(init);
      if (body.credential !== this.pairingSecret) return jsonResponse({ message: 'Unauthorized' }, 401);
      return jsonResponse({ token: this.token });
    }

    if (this.rejectAuth || credential !== `Bearer ${this.token}`) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }

    if (parsed.pathname === '/api/health' && method === 'GET') {
      this.calls.push({ operation: 'ping', endpoint: parsed.origin, credential, redirect });
      return jsonResponse({ version: 'pi-fixture-1' });
    }

    if (parsed.pathname === '/api/sessions' && method === 'POST') {
      const body = readJsonBody(init);
      const intent = readIntent(body.intent);
      const id = piSessionID(String(body.directory), intent);
      this.sessions.set(id, String(body.title));
      this.calls.push({ operation: 'create', endpoint: parsed.origin, credential, redirect, title: String(body.title) });
      return jsonResponse({ id, title: body.title, name: body.title });
    }

    const prompt = /^\/api\/sessions\/([^/]+)\/prompt$/.exec(parsed.pathname);
    if (prompt !== null && method === 'POST') {
      return this.prompt(parsed.origin, decodeURIComponent(prompt[1] ?? ''), credential, redirect, init);
    }

    return jsonResponse({ message: 'Not found' }, 404);
  }

  private prompt(
    endpoint: string,
    sessionID: string,
    credential: string | null,
    redirect: string | undefined,
    init: RequestInit | undefined,
  ): Response {
    if (!this.sessions.has(sessionID)) {
      return jsonResponse({ message: `No session ${sessionID}` }, 404);
    }

    const body = readJsonBody(init);
    const requestID = String(body.requestID);
    const delivery = String(body.streamingBehavior);
    const text = String(body.text ?? '');
    const images = Array.isArray(body.images) ? body.images : [];
    const attachments = images.map((image) => String((image as { uri?: unknown }).uri ?? ''));

    const rejection = this.rejectNextSend;
    if (rejection !== null) {
      this.rejectNextSend = null;
      const status = rejection === 'busy' ? 409 : rejection === 'missing-session' ? 404 : 500;
      this.calls.push({ operation: 'send', endpoint, credential, redirect, sessionID, requestID, delivery, admitted: false });
      return jsonResponse({ message: rejection }, status);
    }

    const previous = this.admittedInputs.get(requestID);
    if (previous !== undefined && previous !== JSON.stringify([sessionID, text, delivery, images])) {
      this.calls.push({ operation: 'send', endpoint, credential, redirect, sessionID, requestID, delivery, admitted: false });
      return jsonResponse({ message: 'This request id was already admitted with different content' }, 409);
    }

    const known = this.admitted.get(requestID);
    if (known === undefined) {
      this.admitted.set(requestID, `pi.msg.${requestID}`);
      this.admittedInputs.set(requestID, JSON.stringify([sessionID, text, delivery, images]));
    }
    const delivered = !(this.loseNextReceipt && known === undefined);
    if (!delivered) this.loseNextReceipt = false;
    this.calls.push({
      operation: 'send',
      endpoint,
      credential,
      redirect,
      sessionID,
      requestID,
      delivery,
      attachmentURIs: attachments,
      admitted: delivered,
    });
    if (!delivered) throw new TypeError('pi bridge connection lost after admission');
    return jsonResponse(
      this.admitWithoutMessageID ? { admitted: true } : { admitted: true, messageID: known ?? `pi.msg.${requestID}` },
    );
  }
}

function readIntent(value: unknown): PiSessionIntent {
  const intent = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    strategyKey: typeof intent.strategyKey === 'string' ? intent.strategyKey : 'unknown',
    generation: typeof intent.generation === 'number' ? intent.generation : 0,
  };
}

export interface PiFixtureBackendConfig {
  id?: string;
  baseUrl?: string;
  token?: string | null;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

const UNEXPECTED_RESPONSE = 'The pi bridge sent an unexpected response';
const SESSION_NOT_FOUND = 'The session does not exist on the pi bridge';
const BUSY = 'The pi session is busy';
const AMBIGUOUS_ADMISSION = 'The pi bridge did not confirm the admission';
const TIMED_OUT = 'The pi bridge did not answer in time';

export class PiFixtureBackend implements AgentBackend {
  readonly id: string;
  readonly label = 'pi (fixture)';
  readonly capabilities: BackendCapabilities = {
    projects: false,
    namedCreation: true,
    delivery: ['queue', 'steer'],
    images: true,
  };
  readonly defaultSessionStrategy = 'per-day';
  readonly onboarding: BackendOnboarding = {
    credentialLabel: 'Bridge token',
    emptyCredentialError: 'Enter the bridge token',
    instructions: ({ endpoint }) => `Run the pi bridge for ${endpoint}, then paste the token it prints:`,
    command: () => 'pi-browsertalk --print-token',
    authenticate: async (input) => ({ token: await this.pair(input.credential) }),
  };

  constructor(private readonly config: PiFixtureBackendConfig = {}) {
    this.id = config.id ?? 'pi-fixture';
  }

  async ping(): Promise<BackendStatus> {
    try {
      const body = await this.request('GET', '/api/health');
      return { ok: true, detail: `pi bridge ${readString(body, 'version') ?? 'unknown'}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'The bridge check failed' };
    }
  }

  async listProjects(): Promise<Project[]> {
    throw new Error('The pi bridge does not list projects');
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    const body = await this.request('POST', '/api/sessions', {
      directory: input.directory,
      title: input.title,
      intent: input.intent,
    });
    const id = readString(body, 'id');
    if (id === null) throw new Error(UNEXPECTED_RESPONSE);
    return { id, title: readString(body, 'title') ?? readString(body, 'name') ?? input.title };
  }

  async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const payload: Record<string, unknown> = {
      requestID: input.requestID,
      text: input.text,
      streamingBehavior: input.delivery === 'queue' ? 'followUp' : 'steer',
    };
    if (input.files !== undefined && input.files.length > 0) {
      payload.images = input.files.map((file) => ({ uri: file.uri, name: file.name, description: file.description }));
    }

    const body = await this.request(
      'POST',
      `/api/sessions/${encodeURIComponent(input.sessionID)}/prompt`,
      payload,
      { ambiguousAdmission: true },
    );
    if (body.admitted !== true) {
      throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION);
    }
    return { admitted: true, messageID: readString(body, 'messageID') };
  }

  private pair(credential: string): Promise<string> {
    return this.request('POST', '/api/pair', { credential }).then((body) => {
      const token = readString(body, 'token');
      if (token === null) throw new Error(UNEXPECTED_RESPONSE);
      return token;
    });
  }

  private async request(
    method: string,
    path: string,
    payload?: Record<string, unknown>,
    options: { ambiguousAdmission?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const parsed = parseServerUrl(this.config.baseUrl ?? '');
    if (!parsed.ok) throw new Error(parsed.error);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs ?? PI_FIXTURE_TIMEOUT_MS);

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token ?? ''}`,
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: controller.signal,
    };
    if (payload !== undefined) {
      init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' };
      init.body = JSON.stringify(payload);
    }

    try {
      let response: Response;
      try {
        const fetchFn = this.config.fetchFn;
        if (fetchFn === undefined) throw new TypeError('no pi bridge transport');
        response = await fetchFn(`${parsed.endpoint}${path}`, init);
      } catch (cause) {
        if (options.ambiguousAdmission === true) throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION, { cause });
        if (timedOut) throw new Error(TIMED_OUT, { cause });
        throw new Error(`Cannot reach the pi bridge at ${parsed.endpoint}`, { cause });
      }

      if (response.redirected) throw new Error('The pi bridge redirected the request; refusing to follow it');
      if (response.status === 401) {
        throw new BackendError('unauthorized', path === '/api/pair' ? 'That bridge token is wrong' : 'The bridge token was rejected');
      }
      if (response.status === 404 && options.ambiguousAdmission === true) throw new BackendError('missing-session', SESSION_NOT_FOUND);
      if (response.status === 409) throw new BackendError('busy', BUSY);
      if (!response.ok) throw new Error(`The pi bridge returned HTTP ${response.status}`);

      try {
        const body: unknown = await response.json();
        return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      } catch (cause) {
        if (options.ambiguousAdmission === true) throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION, { cause });
        if (timedOut) throw new Error(TIMED_OUT, { cause });
        throw new Error(UNEXPECTED_RESPONSE, { cause });
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  return typeof found === 'string' && found.length > 0 ? found : null;
}
