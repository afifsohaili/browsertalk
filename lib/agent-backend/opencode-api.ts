import type { Project } from './interface';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const AUTH_USERNAME = 'opencode';
const UNEXPECTED_RESPONSE = 'The opencode server sent an unexpected response';

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
  const body = await getJson({
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

  private get(path: string): Promise<unknown> {
    return getJson({
      baseUrl: this.config.baseUrl,
      path,
      headers: { Authorization: openCodeAuthHeader(this.config.token) },
      fetchFn: this.config.fetchFn,
      unauthorizedMessage: 'Pairing token rejected',
    });
  }
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
  baseUrl: string;
  path: string;
  headers: Record<string, string>;
  fetchFn?: FetchLike;
  unauthorizedMessage: string;
}

async function getJson(input: JsonRequest): Promise<unknown> {
  const fetchFn = input.fetchFn ?? fetchImpl ?? defaultFetch;
  const url = `${input.baseUrl.replace(/\/+$/, '')}${input.path}`;

  let response: Response;
  try {
    response = await fetchFn(url, { method: 'GET', headers: input.headers });
  } catch (cause) {
    throw new OpenCodeError(`Cannot reach the opencode server at ${input.baseUrl}`, { cause });
  }

  if (response.status === 401) {
    throw new OpenCodeError(input.unauthorizedMessage, { status: response.status });
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
