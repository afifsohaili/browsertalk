import { describe, expect, it } from 'vitest';
import {
  isPanelDiscardResult,
  isPanelRequest,
  isPanelRetryResult,
  isSessionRolloverResult,
  isTargetReadResult,
} from './protocol';

const CONNECTION = { backendId: 'fake', endpoint: 'http://127.0.0.1:15001' };

describe('panel request guard', () => {
  it('accepts the four request shapes', () => {
    expect(isPanelRequest({ type: 'target/read', origin: 'https://example.com' })).toBe(true);
    expect(isPanelRequest({ type: 'outbox/retry', itemId: 'ob_1' })).toBe(true);
    expect(isPanelRequest({ type: 'outbox/discard', itemId: 'ob_1' })).toBe(true);
    expect(isPanelRequest({ type: 'session/rollover', origin: 'https://example.com', connection: CONNECTION })).toBe(
      true,
    );
  });

  it('rejects malformed requests', () => {
    expect(isPanelRequest({ type: 'target/read', origin: '' })).toBe(false);
    expect(isPanelRequest({ type: 'target/read', origin: 7 })).toBe(false);
    expect(isPanelRequest({ type: 'outbox/retry' })).toBe(false);
    expect(isPanelRequest({ type: 'outbox/retry', itemId: 7 })).toBe(false);
    expect(isPanelRequest({ type: 'outbox/discard' })).toBe(false);
    expect(isPanelRequest({ type: 'outbox/discard', itemId: '' })).toBe(false);
    expect(isPanelRequest({ type: 'session/rollover' })).toBe(false);
    expect(isPanelRequest({ type: 'session/rollover', origin: 'https://example.com' })).toBe(false);
    expect(
      isPanelRequest({ type: 'session/rollover', origin: 'https://example.com', connection: { backendId: 'fake' } }),
    ).toBe(false);
  });

  it('leaves other messages alone', () => {
    expect(isPanelRequest({ type: 'outbox/count' })).toBe(false);
    expect(isPanelRequest({ type: 'outbox/changed' })).toBe(false);
    expect(isPanelRequest({ type: 'connection/status' })).toBe(false);
    expect(isPanelRequest('target/read')).toBe(false);
    expect(isPanelRequest(null)).toBe(false);
  });
});

describe('panel result guards', () => {
  it('accepts both target read result shapes', () => {
    expect(
      isTargetReadResult({ ok: true, target: { project: '/home/afif/example', session: null }, connection: CONNECTION }),
    ).toBe(true);
    expect(
      isTargetReadResult({
        ok: true,
        target: { project: '/home/afif/example', session: { id: 'ses_1', title: 'Browsertalk · example' } },
        connection: CONNECTION,
      }),
    ).toBe(true);
    expect(isTargetReadResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed target read results', () => {
    expect(isTargetReadResult({ ok: true, target: { project: null, session: 'no' }, connection: CONNECTION })).toBe(
      false,
    );
    expect(isTargetReadResult({ ok: true, target: { session: null }, connection: CONNECTION })).toBe(false);
    expect(isTargetReadResult({ ok: true, target: { project: null, session: null } })).toBe(false);
    expect(
      isTargetReadResult({
        ok: true,
        target: { project: null, session: null },
        connection: { backendId: 'fake', endpoint: 'https://example.com' },
      }),
    ).toBe(false);
    expect(isTargetReadResult({ ok: true, connection: CONNECTION })).toBe(false);
    expect(isTargetReadResult({ ok: false })).toBe(false);
    expect(isTargetReadResult(null)).toBe(false);
  });

  it('accepts both retry result shapes', () => {
    expect(isPanelRetryResult({ ok: true })).toBe(true);
    expect(isPanelRetryResult({ ok: false, error: 'Not paired' })).toBe(true);
    expect(isPanelRetryResult({ ok: true, error: 'Not paired' })).toBe(false);
    expect(isPanelRetryResult({ ok: false })).toBe(false);
  });

  it('accepts both discard result shapes', () => {
    expect(isPanelDiscardResult({ ok: true })).toBe(true);
    expect(isPanelDiscardResult({ ok: false, error: 'Quota exceeded' })).toBe(true);
    expect(isPanelDiscardResult({ ok: true, error: 'Quota exceeded' })).toBe(false);
    expect(isPanelDiscardResult({ ok: false })).toBe(false);
  });

  it('accepts both rollover result shapes', () => {
    expect(isSessionRolloverResult({ ok: true, session: { id: 'ses_1', title: 'Browsertalk · example' } })).toBe(
      true,
    );
    expect(isSessionRolloverResult({ ok: false, error: 'Not paired' })).toBe(true);
    expect(isSessionRolloverResult({ ok: true, session: { id: '', title: 'x' } })).toBe(false);
    expect(isSessionRolloverResult({ ok: true })).toBe(false);
    expect(isSessionRolloverResult(undefined)).toBe(false);
  });
});
