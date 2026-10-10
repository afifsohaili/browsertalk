import type { BackendCapabilities, SendResult, SessionCreateInput, SessionRef, AgentBackend, BackendStatus, FeedbackSendInput, Project } from '../interface';
import { BackendError } from '../interface';
import { FakeAgentBackend } from '../fake';
import { OpenCodeBackend } from '../opencode';
import { openCodeAuthHeader, type FetchLike } from '../opencode-api';
import { CONFORMANCE_ENDPOINT } from './harness';
import { PI_FIXTURE_PAIRING_SECRET, PI_FIXTURE_TOKEN, PiFixtureBackend, PiFixtureBridge } from './pi-fixture';
import type { AdapterConformanceCase, TransportCall } from './types';
import { headersOf, jsonResponse, readJsonBody, redirectOf } from './wire';

const FAKE_CAPABILITIES: BackendCapabilities = {
  projects: true,
  namedCreation: true,
  delivery: ['queue', 'steer'],
  images: true,
};

const MINIMAL_CAPABILITIES: BackendCapabilities = {
  projects: false,
  namedCreation: false,
  delivery: ['queue'],
  images: false,
};

class FakeScenarioAdapter implements AgentBackend {
  readonly id: string;
  readonly label = 'Fake';
  readonly capabilities: BackendCapabilities;
  readonly onboarding = null;
  readonly defaultSessionStrategy = 'per-day';

  nextSendError: 'busy' | 'missing-session' | 'plain' | null = null;
  loseNextReceipt = false;
  nullMessageIDNext = false;
  turnRunning = false;
  admissionCount = 0;

  private readonly inner: FakeAgentBackend;
  private readonly admittedInputs = new Map<string, string>();

  constructor(id: string, capabilities: BackendCapabilities) {
    this.id = id;
    this.capabilities = capabilities;
    this.inner = new FakeAgentBackend({ capabilities });
  }

  ping(): Promise<BackendStatus> {
    return this.inner.ping();
  }

  listProjects(): Promise<Project[]> {
    return this.inner.listProjects();
  }

  createSession(input: SessionCreateInput): Promise<SessionRef> {
    return this.inner.createSession(input);
  }

  async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const rejection = this.nextSendError;
    if (rejection !== null) {
      this.nextSendError = null;
      if (rejection === 'plain') throw new Error('The fake backend rejected the feedback');
      throw new BackendError(
        rejection,
        rejection === 'busy' ? 'The fake session is busy' : 'The fake session does not exist',
      );
    }

    const fingerprint = `${input.sessionID}\u0000${input.text}`;
    const previous = this.admittedInputs.get(input.requestID);
    if (previous !== undefined && previous !== fingerprint) {
      throw new BackendError('busy', 'The fake backend already admitted this request id with different content');
    }
    const known = previous !== undefined;

    const result = await this.inner.sendFeedback(input);
    if (!known) {
      this.admittedInputs.set(input.requestID, fingerprint);
      this.admissionCount += 1;
    }
    if (this.loseNextReceipt) {
      this.loseNextReceipt = false;
      throw new BackendError('ambiguous-admission', 'The fake backend lost the admission response');
    }
    if (this.nullMessageIDNext) {
      this.nullMessageIDNext = false;
      return { admitted: true, messageID: null };
    }
    return result;
  }
}

function createFakeCase(id: string, label: string, capabilities: BackendCapabilities): AdapterConformanceCase {
  let adapter = new FakeScenarioAdapter(id, capabilities);
  return {
    id,
    label,
    capabilities,
    deterministicIds: false,
    transportSecurity: false,
    deferTurn: true,
    admitsWithoutMessageID: true,
    rejectsConflictingReuse: true,
    deliveryMapping: { queue: 'queue', steer: 'steer' },
    token: null,
    pairing: null,
    credentialHeader: null,
    create: () => adapter,
    transport: () => [],
    admissions: () => adapter.admissionCount,
    reset: () => {
      adapter = new FakeScenarioAdapter(id, capabilities);
    },
    scenarios: {
      rejectNextSend: (kind) => {
        adapter.nextSendError = kind;
      },
      loseNextAdmissionReceipt: () => {
        adapter.loseNextReceipt = true;
      },
      admitWithoutMessageID: () => {
        adapter.nullMessageIDNext = true;
      },
      deferTurnCompletion: () => {
        adapter.turnRunning = true;
        return {
          turnRunning: () => adapter.turnRunning,
          release: () => {
            adapter.turnRunning = false;
          },
        };
      },
    },
  };
}

export function fakeConformanceCases(): AdapterConformanceCase[] {
  return [
    createFakeCase('fake', 'Fake backend', FAKE_CAPABILITIES),
    createFakeCase('fake-minimal', 'Fake backend (minimal capabilities)', MINIMAL_CAPABILITIES),
  ];
}

export const OPENCODE_TOKEN = 'tok-opencode';
export const OPENCODE_PAIRING_CODE = 'PAIR-OK';

const SIM_PROJECT_DIRECTORY = '/home/afif/example';

class OpenCodeServerSim {
  readonly calls: TransportCall[] = [];
  rejectAuth = false;
  rejectNextSend: 'busy' | 'missing-session' | 'plain' | null = null;
  loseNextReceipt = false;
  turnRunning = false;

  private readonly sessions = new Map<string, string>();
  private readonly admitted = new Map<string, string>();
  private readonly admittedInputs = new Map<string, { sessionID: string; text: string }>();
  private nextSession = 1;

  get admissionCount(): number {
    return this.admitted.size;
  }

  readonly fetch: FetchLike = (input, init) => Promise.resolve(this.handle(String(input), init));

  private handle(url: string, init?: RequestInit): Response {
    const parsed = new URL(url);
    const endpoint = parsed.origin;
    const path = parsed.pathname;
    const method = (init?.method ?? 'GET').toUpperCase();
    const credential = headersOf(init).Authorization ?? null;
    const redirect = redirectOf(init);

    if (path.startsWith('/auth/connect/') && method === 'GET') {
      this.calls.push({ operation: 'pair', endpoint, credential, redirect });
      const code = decodeURIComponent(path.slice('/auth/connect/'.length));
      return code === OPENCODE_PAIRING_CODE
        ? jsonResponse({ token: OPENCODE_TOKEN })
        : jsonResponse({ _tag: 'UnauthorizedError' }, 401);
    }

    if (this.rejectAuth || credential !== openCodeAuthHeader(OPENCODE_TOKEN)) {
      return jsonResponse({ _tag: 'UnauthorizedError' }, 401);
    }

    if (path === '/api/info' && method === 'GET') {
      this.calls.push({ operation: 'ping', endpoint, credential, redirect });
      return jsonResponse({ version: '2.0.24' });
    }

    if (path === '/api/project' && method === 'GET') {
      this.calls.push({ operation: 'list-projects', endpoint, credential, redirect });
      return jsonResponse([{ id: 'proj_sim', canonical: SIM_PROJECT_DIRECTORY, name: 'example' }]);
    }

    if (path === '/api/session' && method === 'POST') {
      const body = readJsonBody(init);
      const id = `ses_sim_${this.nextSession}`;
      this.nextSession += 1;
      const title = String(body.title ?? '');
      this.sessions.set(id, title);
      this.calls.push({ operation: 'create', endpoint, credential, redirect, title });
      return jsonResponse({ data: { id, title } });
    }

    const prompt = /^\/api\/session\/([^/]+)\/prompt$/.exec(path);
    if (prompt !== null && method === 'POST') {
      return this.prompt(endpoint, decodeURIComponent(prompt[1] ?? ''), credential, redirect, init);
    }

    return jsonResponse({ _tag: 'NotFoundError' }, 404);
  }

  private prompt(
    endpoint: string,
    sessionID: string,
    credential: string | null,
    redirect: string | undefined,
    init: RequestInit | undefined,
  ): Response {
    const body = readJsonBody(init);
    const requestID = String(body.id ?? '').replace(/^msg_/, '');
    const delivery = String(body.delivery ?? '');
    const text = String(body.text ?? '');
    const files = Array.isArray(body.files) ? body.files : [];
    const attachmentURIs = files.map((file) => String((file as { uri?: unknown }).uri ?? ''));

    if (!this.sessions.has(sessionID)) {
      this.calls.push({ operation: 'send', endpoint, credential, redirect, sessionID, requestID, delivery, admitted: false });
      return jsonResponse({ _tag: 'SessionNotFoundError', sessionID }, 404);
    }

    const rejection = this.rejectNextSend;
    if (rejection !== null) {
      this.rejectNextSend = null;
      const status = rejection === 'busy' ? 409 : rejection === 'missing-session' ? 404 : 500;
      const tag = rejection === 'busy' ? 'SessionBusyError' : rejection === 'missing-session' ? 'SessionNotFoundError' : 'Error';
      this.calls.push({ operation: 'send', endpoint, credential, redirect, sessionID, requestID, delivery, attachmentURIs, admitted: false });
      return jsonResponse({ _tag: tag }, status);
    }

    const previous = this.admittedInputs.get(requestID);
    if (previous !== undefined && (previous.sessionID !== sessionID || previous.text !== text)) {
      this.calls.push({ operation: 'send', endpoint, credential, redirect, sessionID, requestID, delivery, attachmentURIs, admitted: false });
      return jsonResponse({ _tag: 'PromptConflictError' }, 409);
    }

    const known = this.admitted.get(requestID);
    if (known === undefined) {
      this.admitted.set(requestID, `msg_sim_${requestID}`);
      this.admittedInputs.set(requestID, { sessionID, text });
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
      attachmentURIs,
      admitted: delivered,
    });
    if (!delivered) throw new TypeError('sim connection lost after admission');
    return jsonResponse({ data: { id: known ?? `msg_sim_${requestID}` } });
  }
}

export function openCodeConformanceCase(): AdapterConformanceCase {
  let sim = new OpenCodeServerSim();
  return {
    id: 'opencode',
    label: 'opencode backend',
    capabilities: {
      projects: true,
      namedCreation: true,
      delivery: ['queue', 'steer'],
      images: true,
    },
    deterministicIds: false,
    transportSecurity: true,
    deferTurn: true,
    admitsWithoutMessageID: false,
    rejectsConflictingReuse: true,
    deliveryMapping: { queue: 'queue', steer: 'steer' },
    token: OPENCODE_TOKEN,
    pairing: { credential: OPENCODE_PAIRING_CODE, wrongCredential: 'WRONG' },
    credentialHeader: openCodeAuthHeader,
    create: (config) =>
      new OpenCodeBackend({
        baseUrl: config?.baseUrl ?? CONFORMANCE_ENDPOINT,
        token: config?.token ?? '',
        fetchFn: sim.fetch,
      }),
    transport: () => sim.calls,
    admissions: () => sim.admissionCount,
    reset: () => {
      sim = new OpenCodeServerSim();
    },
    scenarios: {
      rejectAuth: () => {
        sim.rejectAuth = true;
      },
      rejectNextSend: (kind) => {
        sim.rejectNextSend = kind;
      },
      loseNextAdmissionReceipt: () => {
        sim.loseNextReceipt = true;
      },
      deferTurnCompletion: () => {
        sim.turnRunning = true;
        return {
          turnRunning: () => sim.turnRunning,
          release: () => {
            sim.turnRunning = false;
          },
        };
      },
    },
  };
}

export function piConformanceCase(): AdapterConformanceCase {
  let bridge = new PiFixtureBridge();
  return {
    id: 'pi-fixture',
    label: 'pi-shaped fixture',
    capabilities: {
      projects: false,
      namedCreation: true,
      delivery: ['queue', 'steer'],
      images: true,
    },
    deterministicIds: true,
    transportSecurity: true,
    deferTurn: true,
    admitsWithoutMessageID: true,
    rejectsConflictingReuse: true,
    deliveryMapping: { queue: 'followUp', steer: 'steer' },
    token: PI_FIXTURE_TOKEN,
    pairing: { credential: PI_FIXTURE_PAIRING_SECRET, wrongCredential: 'WRONG' },
    credentialHeader: (token) => `Bearer ${token}`,
    create: (config) =>
      new PiFixtureBackend({
        baseUrl: config?.baseUrl ?? CONFORMANCE_ENDPOINT,
        token: config?.token ?? '',
        fetchFn: bridge.fetch,
      }),
    transport: () => bridge.calls,
    admissions: () => bridge.admissionCount,
    reset: () => {
      bridge = new PiFixtureBridge();
    },
    scenarios: {
      rejectAuth: () => {
        bridge.rejectAuth = true;
      },
      rejectNextSend: (kind) => {
        bridge.rejectNextSend = kind;
      },
      loseNextAdmissionReceipt: () => {
        bridge.loseNextReceipt = true;
      },
      admitWithoutMessageID: () => {
        bridge.admitWithoutMessageID = true;
      },
      deferTurnCompletion: () => {
        bridge.startTurn();
        return {
          turnRunning: () => bridge.turnRunning,
          release: () => bridge.releaseTurn(),
        };
      },
    },
  };
}
