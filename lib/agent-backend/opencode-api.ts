import { parseServerUrl } from '@/lib/connection/endpoint';
import { BackendError, backendErrorCode } from './interface';
import type {
  FeedbackAttachment,
  Project,
  SendResult,
  SessionCreateInput,
  SessionListQuery,
  SessionRef,
} from './interface';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const AUTH_USERNAME = 'opencode';
const UNEXPECTED_RESPONSE = 'The opencode server sent an unexpected response';
const SESSION_NOT_FOUND = 'The session does not exist on the opencode server';
const REDIRECT_REJECTED = 'The opencode server redirected the request; refusing to follow it';
const BUSY = 'The session is busy';
const AMBIGUOUS_ADMISSION = 'The opencode server did not confirm the admission; the request may have been received';
const TIMED_OUT = 'The opencode server did not answer in time';

export const REQUEST_TIMEOUT_MS = 15_000;

export class OpenCodeError extends Error {
  readonly status: number | null;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'OpenCodeError';
    this.status = options.status ?? null;
  }
}

let fetchImpl: FetchLike | null = null;

export function setOpenCodeFetch(fetchFn: FetchLike): void {
  fetchImpl = fetchFn;
}

export function resetOpenCodeFetch(): void {
  fetchImpl = null;
}

export function openCodeAuthHeader(token: string): string {
  return `Basic ${btoa(`${AUTH_USERNAME}:${token}`)}`;
}

export interface OpenCodeServerInfo {
  version: string;
}

export interface OpenCodeApiConfig {
  baseUrl: string;
  token: string;
  /** The "Allow a remote server" policy; when off, only loopback base URLs are accepted. */
  allowRemote?: boolean;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export interface PairingRedeemInput {
  baseUrl: string;
  code: string;
  allowRemote?: boolean;
  fetchFn?: FetchLike;
}

export async function redeemPairingCode(input: PairingRedeemInput): Promise<string> {
  const body = await requestJson({
    method: 'GET',
    baseUrl: input.baseUrl,
    path: `/auth/connect/${encodeURIComponent(input.code)}`,
    headers: { Accept: 'application/json' },
    allowRemote: input.allowRemote,
    fetchFn: input.fetchFn,
    unauthorizedMessage: 'That pairing code is wrong or expired',
  });
  const token = readString(body, 'token');
  if (token === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);
  return token;
}

export class OpenCodeApi {
  constructor(private readonly config: OpenCodeApiConfig) {}

  async info(): Promise<OpenCodeServerInfo> {
    const body = await this.get('/api/info');
    const version = readString(body, 'version');
    if (version === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);
    return { version };
  }

  async listProjects(): Promise<Project[]> {
    const body = await this.get('/api/project');
    if (!Array.isArray(body)) throw new OpenCodeError(UNEXPECTED_RESPONSE);
    return body.map((item) => toProject(item));
  }

  async createSession(input: SessionCreateInput): Promise<SessionRef> {
    const body = await this.post('/api/session', {
      title: input.title,
      location: { directory: input.directory },
    });
    const data = readRecord(body, 'data');
    const id = readString(data, 'id');
    if (id === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);
    return { id, title: readString(data, 'title') ?? input.title };
  }

  async listSessions(query: SessionListQuery): Promise<SessionRef[]> {
    const params = new URLSearchParams();
    if (query.directory !== undefined && query.directory.length > 0) params.set('directory', query.directory);
    if (query.search !== undefined && query.search.length > 0) params.set('search', query.search);
    if (query.rootsOnly === true) params.set('parentID', 'null');
    params.set('order', 'desc');

    const body = await this.get(`/api/session?${params.toString()}`);
    const data = readRecord(body, 'data');
    if (!Array.isArray(data)) throw new OpenCodeError(UNEXPECTED_RESPONSE);
    return data.filter((item) => query.rootsOnly !== true || !hasParent(item)).map((item) => toSessionRef(item));
  }

  async getSession(sessionID: string): Promise<SessionRef | null> {
    let body: unknown;
    try {
      body = await this.get(`/api/session/${encodeURIComponent(sessionID)}`, {
        notFoundMessage: SESSION_NOT_FOUND,
      });
    } catch (error) {
      if (backendErrorCode(error) === 'missing-session') return null;
      throw error;
    }
    const data = readRecord(body, 'data');
    const id = readString(data, 'id');
    if (id === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);
    return { id, title: readString(data, 'title') ?? id };
  }

  async sendPrompt(input: SendPromptInput): Promise<SendResult> {
    const payload: Record<string, unknown> = {
      id: `msg_${input.requestID}`,
      text: input.text,
      delivery: input.delivery,
    };
    if (input.files !== undefined && input.files.length > 0) payload.files = input.files;

    const body = await this.post(`/api/session/${encodeURIComponent(input.sessionID)}/prompt`, payload, {
      notFoundMessage: SESSION_NOT_FOUND,
      ambiguousAdmission: true,
    });
    const messageID = readString(readRecord(body, 'data'), 'id');
    if (messageID === null) throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION);
    return { admitted: true, messageID };
  }

  private get(path: string, options: { notFoundMessage?: string } = {}): Promise<unknown> {
    return requestJson({
      method: 'GET',
      baseUrl: this.config.baseUrl,
      path,
      headers: { Authorization: openCodeAuthHeader(this.config.token) },
      allowRemote: this.config.allowRemote,
      fetchFn: this.config.fetchFn,
      timeoutMs: this.config.timeoutMs,
      unauthorizedMessage: 'Pairing token rejected',
      notFoundMessage: options.notFoundMessage,
    });
  }

  private post(
    path: string,
    payload: Record<string, unknown>,
    options: { notFoundMessage?: string; ambiguousAdmission?: boolean } = {},
  ): Promise<unknown> {
    return requestJson({
      method: 'POST',
      baseUrl: this.config.baseUrl,
      path,
      headers: {
        Authorization: openCodeAuthHeader(this.config.token),
        'Content-Type': 'application/json',
      },
      body: payload,
      allowRemote: this.config.allowRemote,
      fetchFn: this.config.fetchFn,
      timeoutMs: this.config.timeoutMs,
      unauthorizedMessage: 'Pairing token rejected',
      notFoundMessage: options.notFoundMessage,
      ambiguousAdmission: options.ambiguousAdmission,
    });
  }
}

export interface SendPromptInput {
  sessionID: string;
  text: string;
  delivery: 'queue' | 'steer';
  requestID: string;
  files?: FeedbackAttachment[];
}

export function toProject(value: unknown): Project {
  const id = readString(value, 'id');
  const directory = readString(value, 'canonical');
  if (id === null || directory === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);

  const name = readString(value, 'name');
  return { id, name: name ?? projectNameFromDirectory(directory), directory };
}

function toSessionRef(value: unknown): SessionRef {
  const id = readString(value, 'id');
  if (id === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);
  return { id, title: readString(value, 'title') ?? id };
}

function hasParent(value: unknown): boolean {
  return readString(value, 'parentID') !== null;
}

export function projectNameFromDirectory(directory: string): string {
  const trimmed = directory.replace(/\/+$/, '');
  if (trimmed.length === 0) return directory;

  const separator = trimmed.lastIndexOf('/');
  return separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
}

interface JsonRequest {
  method: string;
  baseUrl: string;
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  allowRemote?: boolean;
  fetchFn?: FetchLike;
  timeoutMs?: number;
  unauthorizedMessage: string;
  notFoundMessage?: string;
  ambiguousAdmission?: boolean;
}

async function requestJson(input: JsonRequest): Promise<unknown> {
  const parsed = parseServerUrl(input.baseUrl, { allowRemote: input.allowRemote === true });
  if (!parsed.ok) throw new OpenCodeError(parsed.error);

  const fetchFn = input.fetchFn ?? fetchImpl ?? defaultFetch;
  const url = `${parsed.endpoint}${input.path}`;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs ?? REQUEST_TIMEOUT_MS);

  const init: RequestInit = {
    method: input.method,
    headers: input.headers,
    redirect: 'error',
    signal: controller.signal,
  };
  if (input.body !== undefined) init.body = JSON.stringify(input.body);

  try {
    let response: Response;
    try {
      response = await fetchFn(url, init);
    } catch (cause) {
      if (input.ambiguousAdmission === true) {
        throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION, { cause });
      }
      if (timedOut) throw new OpenCodeError(TIMED_OUT, { cause });
      throw new OpenCodeError(`Cannot reach the opencode server at ${parsed.endpoint}`, { cause });
    }

    if (response.redirected) {
      throw new OpenCodeError(REDIRECT_REJECTED, { status: response.status });
    }
    if (response.status === 401) {
      throw new BackendError('unauthorized', input.unauthorizedMessage);
    }
    if (response.status === 404 && input.notFoundMessage !== undefined) {
      throw new BackendError('missing-session', input.notFoundMessage);
    }
    if (response.status === 409) {
      throw new BackendError('busy', BUSY);
    }
    if (!response.ok) {
      throw new OpenCodeError(`The opencode server returned HTTP ${response.status}`, {
        status: response.status,
      });
    }

    try {
      return await response.json();
    } catch (cause) {
      if (input.ambiguousAdmission === true) {
        throw new BackendError('ambiguous-admission', AMBIGUOUS_ADMISSION, { cause });
      }
      if (timedOut) throw new OpenCodeError(TIMED_OUT, { cause });
      throw new OpenCodeError(UNEXPECTED_RESPONSE, { cause });
    }
  } finally {
    clearTimeout(timer);
  }
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

function readString(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' && found.length > 0 ? found : null;
}

function readRecord(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return null;
  return (value as Record<string, unknown>)[key] ?? null;
}
