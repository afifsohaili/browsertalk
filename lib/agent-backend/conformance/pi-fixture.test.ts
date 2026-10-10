import { describe, expect, it } from 'vitest';
import { backendErrorCode } from '../interface';
import type { FetchLike } from '../opencode-api';
import { CONFORMANCE_ENDPOINT } from './harness';
import { PI_FIXTURE_TOKEN, PiFixtureBackend } from './pi-fixture';

function stalledJsonResponse(init: RequestInit | undefined): Response {
  const stream = new ReadableStream({
    start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } });
}

function stalledBackend(): PiFixtureBackend {
  return new PiFixtureBackend({
    baseUrl: CONFORMANCE_ENDPOINT,
    token: PI_FIXTURE_TOKEN,
    timeoutMs: 20,
    fetchFn: (async (_url, init) => stalledJsonResponse(init)) as FetchLike,
  });
}

describe('pi fixture deadlines', () => {
  it('keeps the deadline over a stalled response body and reports an ambiguous admission', async () => {
    const error = await stalledBackend()
      .sendFeedback({ sessionID: 'pi.example', text: 'hello', delivery: 'queue', requestID: 'req_1' })
      .catch((cause: unknown) => cause);

    expect(backendErrorCode(error)).toBe('ambiguous-admission');
  });

  it('keeps the deadline over the body of a non-admission response', async () => {
    await expect(stalledBackend().ping()).resolves.toEqual({
      ok: false,
      detail: 'The pi bridge did not answer in time',
    });
  });
});
