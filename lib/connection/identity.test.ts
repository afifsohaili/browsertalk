import { describe, expect, it } from 'vitest';
import { connectionKey } from './identity';

describe('connectionKey', () => {
  it('combines the backend id and the canonical endpoint', () => {
    expect(connectionKey({ backendId: 'opencode', endpoint: 'http://127.0.0.1:15001' })).toBe(
      'opencode@http://127.0.0.1:15001',
    );
  });

  it('keeps different endpoints and backends apart', () => {
    const a = connectionKey({ backendId: 'opencode', endpoint: 'http://127.0.0.1:15001' });
    const b = connectionKey({ backendId: 'opencode', endpoint: 'http://127.0.0.1:4096' });
    const c = connectionKey({ backendId: 'pi', endpoint: 'http://127.0.0.1:15001' });

    expect(new Set([a, b, c]).size).toBe(3);
  });
});
