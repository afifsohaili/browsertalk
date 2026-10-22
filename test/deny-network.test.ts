import { afterEach, describe, expect, it } from 'vitest';
import { probeServer, resetOpenCodeFetch, setOpenCodeFetch } from '@/lib/agent-backend/opencode-api';

describe('deny-network guard', () => {
  afterEach(() => {
    resetOpenCodeFetch();
  });

  it('blocks a native fetch call', () => {
    expect(() => fetch('http://127.0.0.1:15001/api/info')).toThrow(
      'Denied native fetch in tests to http://127.0.0.1:15001/api/info. Inject the response with setOpenCodeFetch() or pass fetchFn.',
    );
  });

  it('leaves an injected response working', async () => {
    setOpenCodeFetch(async () => new Response(JSON.stringify({ version: '2.0.32' }), { status: 200 }));

    await expect(probeServer({ baseUrl: 'http://127.0.0.1:15001' })).resolves.toEqual({ version: '2.0.32' });
  });
});
