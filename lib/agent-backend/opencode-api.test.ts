import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendErrorCode } from './interface';
import {
  OpenCodeApi,
  redeemPairingCode,
  resetOpenCodeFetch,
  setOpenCodeFetch,
  type FetchLike,
} from './opencode-api';

const BASE = 'http://127.0.0.1:15001';
const INTENT = { strategyId: 'per-day', strategyKey: '/d::2026-10-10', generation: 0 } as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

describe('redeemPairingCode', () => {
  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('refuses a remote server URL without touching the network', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(redeemPairingCode({ baseUrl: 'https://example.com', code: 'ABC123' })).rejects.toThrow(
      'The server must be on this machine',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a URL with embedded credentials', async () => {
    const fetchFn = vi.fn<FetchLike>();
    setOpenCodeFetch(fetchFn);

    await expect(
      redeemPairingCode({ baseUrl: 'http://user:pass@127.0.0.1:15001', code: 'ABC123' }),
    ).rejects.toThrow('Remove the username and password from the server URL');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('exchanges a pairing code for the token', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ token: 'tok_live' }));
    setOpenCodeFetch(fetchFn);

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).resolves.toBe('tok_live');

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/auth/connect/ABC123`);
    expect(call?.[1]?.method).toBe('GET');
    expect(call?.[1]?.headers).toEqual({ Accept: 'application/json' });
  });

  it('rejects a wrong or expired code with a clear message', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () =>
      jsonResponse({ _tag: 'UnauthorizedError', message: 'Pairing link expired or already used' }, 401),
    ));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'WRONG' })).rejects.toThrow(
      'That pairing code is wrong or expired',
    );
  });

  it('reports an unreachable server with its URL', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      `Cannot reach the opencode server at ${BASE}`,
    );
  });

  it('rejects a response without a token', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ nope: true })));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      'The opencode server sent an unexpected response',
    );
  });

  it('rejects a body that is not JSON', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => textResponse('<html>nope</html>')));

    await expect(redeemPairingCode({ baseUrl: BASE, code: 'ABC123' })).rejects.toThrow(
      'The opencode server sent an unexpected response',
    );
  });
});

describe('OpenCodeApi transport security', () => {
  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('refuses a stored non-loopback base URL before any fetch', async () => {
    const fetchFn = vi.fn<FetchLike>();
    const api = new OpenCodeApi({ baseUrl: 'https://example.com', token: 'tok_live', fetchFn });

    await expect(api.info()).rejects.toThrow('The server must be on this machine');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('forbids redirects so credentials can never be carried off loopback', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' }));
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await api.info();

    expect(fetchFn.mock.calls[0]?.[1]?.redirect).toBe('error');
  });

  it('refuses a response that was redirected anyway', async () => {
    const redirected = jsonResponse({ version: '2.0.24' });
    Object.defineProperty(redirected, 'redirected', { value: true });
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => redirected),
    });

    await expect(api.info()).rejects.toThrow('redirected the request');
  });

  it('never follows a loopback to remote redirect', async () => {
    const requested: string[] = [];
    const fetchFn = vi.fn<FetchLike>(async (url: string | URL | Request, init?: RequestInit) => {
      requested.push(String(url));
      expect(init?.redirect).toBe('error');
      if (String(url).startsWith(BASE)) throw new TypeError('Failed to fetch');
      return jsonResponse({ data: { id: 'msg_1' } });
    });
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await expect(
      api.sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' }),
    ).rejects.toThrow(`Cannot reach the opencode server at ${BASE}`);
    expect(requested).toEqual([`${BASE}/api/session/ses_x/prompt`]);
  });

  it('uses the canonical endpoint so a trailing slash cannot change routing', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24' }));
    const api = new OpenCodeApi({ baseUrl: `${BASE}/`, token: 'tok_live', fetchFn });

    await api.info();

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/info`);
  });
});

describe('OpenCodeApi.info', () => {
  it('sends the token as a basic-auth password and returns the version', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ version: '2.0.24', pid: 1 }));
    const api = new OpenCodeApi({ baseUrl: `${BASE}/`, token: 'tok_live', fetchFn });

    await expect(api.info()).resolves.toEqual({ version: '2.0.24' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/info`);
    expect(call?.[1]?.headers).toEqual({ Authorization: 'Basic b3BlbmNvZGU6dG9rX2xpdmU=' });
  });

  it('reports a rejected token', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'stale',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)),
    });

    await expect(api.info()).rejects.toThrow('Pairing token rejected');
  });

  it('rejects a response without a version', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({})),
    });

    await expect(api.info()).rejects.toThrow('The opencode server sent an unexpected response');
  });
});

describe('OpenCodeApi.listProjects', () => {
  function project(overrides: Record<string, unknown>): unknown {
    return {
      id: 'proj_1',
      canonical: '/home/afif/example',
      time: { created: 1, updated: 1, active: 1 },
      sandboxes: [],
      ...overrides,
    };
  }

  it('maps server projects to name and directory', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse([project({})]));
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await expect(api.listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'example', directory: '/home/afif/example' },
    ]);

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/api/project`);
  });

  it('prefers the server-side name and trims a trailing slash', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () =>
        jsonResponse([project({ name: 'Example App', canonical: '/home/afif/example/' })]),
      ),
    });

    await expect(api.listProjects()).resolves.toEqual([
      { id: 'proj_1', name: 'Example App', directory: '/home/afif/example/' },
    ]);
  });

  it('returns an empty list when the server knows no projects', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse([])),
    });

    await expect(api.listProjects()).resolves.toEqual([]);
  });

  it('rejects a project without a directory', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse([{ id: 'proj_1' }])),
    });

    await expect(api.listProjects()).rejects.toThrow('The opencode server sent an unexpected response');
  });

  it('rejects a body that is not an array', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ data: [] })),
    });

    await expect(api.listProjects()).rejects.toThrow('The opencode server sent an unexpected response');
  });
});

describe('OpenCodeApi.createSession', () => {
  it('posts the title and location, and returns the created ref', async () => {
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse({
        data: {
          id: 'ses_abc',
          projectID: 'proj_1',
          title: 'Browsertalk · example · 2026-10-10',
          time: { created: 1, updated: 1 },
        },
      }),
    );
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await expect(api.createSession({ directory: '/home/afif/example', title: 'T', intent: INTENT })).resolves.toEqual({
      id: 'ses_abc',
      title: 'Browsertalk · example · 2026-10-10',
    });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/session`);
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.headers).toEqual({
      Authorization: 'Basic b3BlbmNvZGU6dG9rX2xpdmU=',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      title: 'T',
      location: { directory: '/home/afif/example' },
    });
  });

  it('falls back to the requested title when the server omits one', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ data: { id: 'ses_abc' } })),
    });

    await expect(api.createSession({ directory: '/home/afif/example', title: 'Fallback', intent: INTENT })).resolves.toEqual(
      { id: 'ses_abc', title: 'Fallback' },
    );
  });

  it('rejects a response without a session id', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ data: {} })),
    });

    await expect(api.createSession({ directory: '/d', title: 'T', intent: INTENT })).rejects.toThrow(
      'The opencode server sent an unexpected response',
    );
  });

  it('reports a rejected token', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'stale',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)),
    });

    await expect(api.createSession({ directory: '/d', title: 'T', intent: INTENT })).rejects.toThrow('Pairing token rejected');
  });

  it('reports an unreachable server with its URL', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      }),
    });

    await expect(api.createSession({ directory: '/d', title: 'T', intent: INTENT })).rejects.toThrow(
      `Cannot reach the opencode server at ${BASE}`,
    );
  });
});

describe('OpenCodeApi.sendPrompt', () => {
  it('posts text, queue delivery, and files, and returns the message id', async () => {
    const fetchFn = vi.fn<FetchLike>(async () =>
      jsonResponse({ data: { id: 'msg_1', sessionID: 'ses_x', type: 'user' } }),
    );
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await expect(
      api.sendPrompt({
        sessionID: 'ses_x',
        text: 'hello',
        delivery: 'queue',
        files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
      }),
    ).resolves.toEqual({ messageID: 'msg_1' });

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe(`${BASE}/api/session/ses_x/prompt`);
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.headers).toEqual({
      Authorization: 'Basic b3BlbmNvZGU6dG9rX2xpdmU=',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      text: 'hello',
      delivery: 'queue',
      files: [{ uri: 'data:image/png;base64,AAAA', name: 'element.png', description: 'Element screenshot' }],
    });
  });

  it('omits the files key when there is no attachment', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ data: { id: 'msg_1' } }));
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await api.sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' });

    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toEqual({
      text: 'hello',
      delivery: 'queue',
    });
  });

  it('passes steer through when asked', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => jsonResponse({ data: { id: 'msg_1' } }));
    const api = new OpenCodeApi({ baseUrl: BASE, token: 'tok_live', fetchFn });

    await api.sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'steer' });

    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)).delivery).toBe('steer');
  });

  it('reports a session the server does not have', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () =>
        jsonResponse({ _tag: 'SessionNotFoundError', sessionID: 'ses_x' }, 404),
      ),
    });

    await expect(api.sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' })).rejects.toThrow(
      'The session does not exist on the opencode server',
    );
  });

  it('returns a null message id when the server omits one', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ data: {} })),
    });

    await expect(api.sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' })).resolves.toEqual({
      messageID: null,
    });
  });
});

describe('OpenCodeApi error codes', () => {
  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('maps a rejected token to unauthorized', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'stale',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)),
    });

    const error = await api.info().catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('unauthorized');
    expect((error as Error).message).toBe('Pairing token rejected');
  });

  it('maps a wrong or expired pairing code to unauthorized', async () => {
    setOpenCodeFetch(vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'UnauthorizedError' }, 401)));

    const error = await redeemPairingCode({ baseUrl: BASE, code: 'WRONG' }).catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('unauthorized');
    expect((error as Error).message).toBe('That pairing code is wrong or expired');
  });

  it('maps a session the server does not have to missing-session', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'SessionNotFoundError' }, 404)),
    });

    const error = await api
      .sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' })
      .catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('missing-session');
    expect((error as Error).message).toBe('The session does not exist on the opencode server');
  });

  it('maps a busy session to busy', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => jsonResponse({ _tag: 'SessionBusyError' }, 409)),
    });

    const error = await api
      .sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' })
      .catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('busy');
    expect((error as Error).message).toBe('The session is busy');
  });

  it('maps an unreadable admission response to ambiguous-admission', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => textResponse('<html>ok</html>')),
    });

    const error = await api
      .sendPrompt({ sessionID: 'ses_x', text: 'hello', delivery: 'queue' })
      .catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('ambiguous-admission');
  });

  it('keeps a 2xx parse failure on other operations unexpected, not ambiguous', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => textResponse('<html>ok</html>')),
    });

    const error = await api
      .createSession({ directory: '/d', title: 'T', intent: INTENT })
      .catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBeNull();
    expect((error as Error).message).toBe('The opencode server sent an unexpected response');
  });

  it('reports no code for an unreachable server', async () => {
    const api = new OpenCodeApi({
      baseUrl: BASE,
      token: 'tok_live',
      fetchFn: vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      }),
    });

    const error = await api.info().catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBeNull();
  });
});
