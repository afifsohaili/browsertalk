import { describe, expect, it } from 'vitest';
import { connectionKey, sameConnection } from './identity';

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

describe('sameConnection', () => {
  it('matches only the same backend and endpoint pair', () => {
    const identity = { backendId: 'opencode', endpoint: 'http://127.0.0.1:15001' };

    expect(sameConnection(identity, { backendId: 'opencode', endpoint: 'http://127.0.0.1:15001' })).toBe(true);
    expect(sameConnection(identity, { backendId: 'opencode', endpoint: 'http://127.0.0.1:4096' })).toBe(false);
    expect(sameConnection(identity, { backendId: 'pi', endpoint: 'http://127.0.0.1:15001' })).toBe(false);
  });
});
