import { describe, expect, it } from 'vitest';
import {
  isComposerOpenResult,
  isComposerQueueResult,
  isComposerRequest,
  isOutboxChanged,
  isOutboxCountResult,
} from './protocol';

describe('composer request guard', () => {
  it('accepts the four request shapes', () => {
    expect(isComposerRequest({ type: 'composer/open' })).toBe(true);
    expect(
      isComposerRequest({
        type: 'composer/queue',
        mode: 'element',
        comment: 'Looks off',
        page: { url: 'https://example.com/', title: 'Example' },
      }),
    ).toBe(true);
    expect(
      isComposerRequest({
        type: 'composer/queue',
        mode: 'page',
        comment: 'Layout jumps',
        page: { url: 'https://example.com/', title: 'Example' },
      }),
    ).toBe(true);
    expect(isComposerRequest({ type: 'outbox/url-only' })).toBe(true);
    expect(isComposerRequest({ type: 'outbox/count' })).toBe(true);
  });

  it('rejects malformed queue requests', () => {
    const page = { url: 'https://example.com/', title: 'Example' };
    expect(isComposerRequest({ type: 'composer/queue', mode: 'element', comment: 7, page })).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', mode: 'bogus', comment: 'x', page })).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', mode: 'page', comment: 'x', page: { url: 1 } })).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', mode: 'page', comment: 'x' })).toBe(false);
  });

  it('leaves other messages alone', () => {
    expect(isComposerRequest({ type: 'picker/arm' })).toBe(false);
    expect(isComposerRequest({ type: 'connection/status' })).toBe(false);
    expect(isComposerRequest({ type: 'outbox/changed' })).toBe(false);
    expect(isComposerRequest('composer/open')).toBe(false);
    expect(isComposerRequest(null)).toBe(false);
  });
});

describe('outbox changed guard', () => {
  it('accepts only the broadcast event', () => {
    expect(isOutboxChanged({ type: 'outbox/changed' })).toBe(true);
    expect(isOutboxChanged({ type: 'outbox/count' })).toBe(false);
    expect(isOutboxChanged(null)).toBe(false);
  });
});

describe('composer result guards', () => {
  it('accepts both composer open result shapes', () => {
    expect(isComposerOpenResult({ ok: true })).toBe(true);
    expect(isComposerOpenResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed composer open results', () => {
    expect(isComposerOpenResult({ ok: true, error: 'nope' })).toBe(false);
    expect(isComposerOpenResult({ ok: false })).toBe(false);
    expect(isComposerOpenResult(undefined)).toBe(false);
  });

  it('accepts both queue result shapes', () => {
    expect(isComposerQueueResult({ ok: true, outboxCount: 2 })).toBe(true);
    expect(isComposerQueueResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed queue results', () => {
    expect(isComposerQueueResult({ ok: true })).toBe(false);
    expect(isComposerQueueResult({ ok: true, outboxCount: '2' })).toBe(false);
    expect(isComposerQueueResult({ ok: true, outboxCount: Number.NaN })).toBe(false);
    expect(isComposerQueueResult(null)).toBe(false);
  });

  it('accepts both count result shapes', () => {
    expect(isOutboxCountResult({ ok: true, count: 0 })).toBe(true);
    expect(isOutboxCountResult({ ok: false, error: 'nope' })).toBe(true);
    expect(isOutboxCountResult({ ok: true, count: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isOutboxCountResult({ ok: true, count: '3' })).toBe(false);
  });
});
