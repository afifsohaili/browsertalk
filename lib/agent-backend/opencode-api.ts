import { parseLoopbackUrl } from '@/lib/connection/endpoint';
import type { FeedbackAttachment, Project, SendResult, SessionCreateInput, SessionRef } from './interface';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const AUTH_USERNAME = 'opencode';
const UNEXPECTED_RESPONSE = 'The opencode server sent an unexpected response';
const SESSION_NOT_FOUND = 'The session does not exist on the opencode server';
const REDIRECT_REJECTED = 'The opencode server redirected the request; refusing to follow it';

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
  fetchFn?: FetchLike;
}

export interface PairingRedeemInput {
  baseUrl: string;
  code: string;
  fetchFn?: FetchLike;
}

export async function redeemPairingCode(input: PairingRedeemInput): Promise<string> {
  const body = await requestJson({
    method: 'GET',
    baseUrl: input.baseUrl,
    path: `/auth/connect/${encodeURIComponent(input.code)}`,
    headers: { Accept: 'application/json' },
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

  async sendPrompt(input: SendPromptInput): Promise<SendResult> {
    const payload: Record<string, unknown> = { text: input.text, delivery: input.delivery };
    if (input.files !== undefined && input.files.length > 0) payload.files = input.files;

    const body = await this.post(`/api/session/${encodeURIComponent(input.sessionID)}/prompt`, payload, {
      notFoundMessage: SESSION_NOT_FOUND,
    });
    return { messageID: readString(readRecord(body, 'data'), 'id') };
  }

  private get(path: string): Promise<unknown> {
    return requestJson({
      method: 'GET',
      baseUrl: this.config.baseUrl,
      path,
      headers: { Authorization: openCodeAuthHeader(this.config.token) },
      fetchFn: this.config.fetchFn,
      unauthorizedMessage: 'Pairing token rejected',
    });
  }

  private post(
    path: string,
    payload: Record<string, unknown>,
    options: { notFoundMessage?: string } = {},
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
      fetchFn: this.config.fetchFn,
      unauthorizedMessage: 'Pairing token rejected',
      notFoundMessage: options.notFoundMessage,
    });
  }
}

export interface SendPromptInput {
  sessionID: string;
  text: string;
  delivery: 'queue' | 'steer';
  files?: FeedbackAttachment[];
}

export function toProject(value: unknown): Project {
  const id = readString(value, 'id');
  const directory = readString(value, 'canonical');
  if (id === null || directory === null) throw new OpenCodeError(UNEXPECTED_RESPONSE);

  const name = readString(value, 'name');
  return { id, name: name ?? projectNameFromDirectory(directory), directory };
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
  fetchFn?: FetchLike;
  unauthorizedMessage: string;
  notFoundMessage?: string;
}

async function requestJson(input: JsonRequest): Promise<unknown> {
  const parsed = parseLoopbackUrl(input.baseUrl);
  if (!parsed.ok) throw new OpenCodeError(parsed.error);

  const fetchFn = input.fetchFn ?? fetchImpl ?? defaultFetch;
  const url = `${parsed.endpoint}${input.path}`;

  const init: RequestInit = { method: input.method, headers: input.headers, redirect: 'error' };
  if (input.body !== undefined) init.body = JSON.stringify(input.body);

  let response: Response;
  try {
    response = await fetchFn(url, init);
  } catch (cause) {
    throw new OpenCodeError(`Cannot reach the opencode server at ${parsed.endpoint}`, { cause });
  }

  if (response.redirected) {
    throw new OpenCodeError(REDIRECT_REJECTED, { status: response.status });
  }
  if (response.status === 401) {
    throw new OpenCodeError(input.unauthorizedMessage, { status: response.status });
  }
  if (response.status === 404 && input.notFoundMessage !== undefined) {
    throw new OpenCodeError(input.notFoundMessage, { status: response.status });
  }
  if (!response.ok) {
    throw new OpenCodeError(`The opencode server returned HTTP ${response.status}`, {
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new OpenCodeError(UNEXPECTED_RESPONSE, { cause });
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
