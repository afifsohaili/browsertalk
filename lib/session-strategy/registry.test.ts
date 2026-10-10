import { beforeAll, describe, expect, it } from 'vitest';
import type { SessionStrategy } from './interface';
import { getSessionStrategy, listSessionStrategies, registerSessionStrategy } from './registry';

function stub(id: SessionStrategy['id']): SessionStrategy {
  return {
    id,
    label: id,
    resolveSession: async () => ({ id: `ses_${id}`, title: id }),
    rolloverSession: async () => ({ id: `ses_${id}`, title: id }),
  };
}

describe('session strategy registry', () => {
  beforeAll(() => {
    registerSessionStrategy('per-day', () => stub('per-day'));
    registerSessionStrategy('sticky', () => stub('sticky'));
  });

  it('lists the registered strategies', () => {
    expect(listSessionStrategies()).toEqual(['per-day', 'sticky']);
  });

  it('builds a fresh strategy per get', () => {
    const first = getSessionStrategy('per-day');
    const second = getSessionStrategy('per-day');

    expect(first).not.toBe(second);
    expect(first.id).toBe('per-day');
  });

  it('rejects a duplicate registration', () => {
    expect(() => registerSessionStrategy('per-day', () => stub('per-day'))).toThrow(
      'Session strategy "per-day" is already registered',
    );
  });

  it('fails fast on an unknown id with the known list', () => {
    expect(() => getSessionStrategy('nope')).toThrow(
      'Session strategy "nope" is not registered. Registered strategies: per-day, sticky',
    );
  });
});
