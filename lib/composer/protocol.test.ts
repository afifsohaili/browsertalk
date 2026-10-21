import { describe, expect, it } from 'vitest';
import {
  isComposerQueueResult,
  isComposerRemoveResult,
  isComposerRequest,
  isOutboxChanged,
  isOutboxCountResult,
} from './protocol';

describe('composer request guard', () => {
  it('accepts the four request shapes', () => {
    expect(
      isComposerRequest({
        type: 'composer/queue',
        comment: 'Looks off',
        page: { url: 'https://example.com/', title: 'Example' },
        captureID: 'fb_1',
        elementCount: 1,
      }),
    ).toBe(true);
    expect(isComposerRequest({ type: 'composer/remove', captureID: 'fb_1', index: 2 })).toBe(true);
    expect(isComposerRequest({ type: 'outbox/page-comment', comment: 'Layout jumps' })).toBe(true);
    expect(isComposerRequest({ type: 'outbox/page-comment', comment: '' })).toBe(true);
    expect(isComposerRequest({ type: 'outbox/count' })).toBe(true);
  });

  it('rejects malformed remove requests', () => {
    expect(isComposerRequest({ type: 'composer/remove', captureID: 'fb_1' })).toBe(false);
    expect(isComposerRequest({ type: 'composer/remove', captureID: '', index: 0 })).toBe(false);
    expect(isComposerRequest({ type: 'composer/remove', captureID: 'fb_1', index: -1 })).toBe(false);
    expect(isComposerRequest({ type: 'composer/remove', captureID: 'fb_1', index: 1.5 })).toBe(false);
    expect(isComposerRequest({ type: 'composer/remove', captureID: 'fb_1', index: '0' })).toBe(false);
  });

  it('rejects malformed queue requests', () => {
    const page = { url: 'https://example.com/', title: 'Example' };
    expect(isComposerRequest({ type: 'composer/queue', comment: 7, page, captureID: 'fb_1', elementCount: 1 })).toBe(
      false,
    );
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', page, captureID: '', elementCount: 1 })).toBe(
      false,
    );
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', page, elementCount: 1 })).toBe(false);
    expect(
      isComposerRequest({ type: 'composer/queue', comment: 'x', page: { url: 1 }, captureID: 'fb_1', elementCount: 1 }),
    ).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', captureID: 'fb_1', elementCount: 1 })).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', page, captureID: 'fb_1' })).toBe(false);
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', page, captureID: 'fb_1', elementCount: 0 })).toBe(
      false,
    );
    expect(isComposerRequest({ type: 'composer/queue', comment: 'x', page, captureID: 'fb_1', elementCount: 1.5 })).toBe(
      false,
    );
    expect(
      isComposerRequest({ type: 'composer/queue', comment: 'x', page, captureID: 'fb_1', elementCount: '1' }),
    ).toBe(false);
    expect(isComposerRequest({ type: 'outbox/page-comment' })).toBe(false);
    expect(isComposerRequest({ type: 'outbox/page-comment', comment: 7 })).toBe(false);
    expect(isComposerRequest({ type: 'composer/open' })).toBe(false);
    expect(isComposerRequest({ type: 'outbox/url-only' })).toBe(false);
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
  it('accepts both queue result shapes', () => {
    expect(isComposerQueueResult({ ok: true, outboxCount: 2 })).toBe(true);
    expect(isComposerQueueResult({ ok: true, outboxCount: 2, screenshotDropped: true })).toBe(true);
    expect(isComposerQueueResult({ ok: false, error: 'nope' })).toBe(true);
  });

  it('rejects malformed queue results', () => {
    expect(isComposerQueueResult({ ok: true })).toBe(false);
    expect(isComposerQueueResult({ ok: true, outboxCount: '2' })).toBe(false);
    expect(isComposerQueueResult({ ok: true, outboxCount: Number.NaN })).toBe(false);
    expect(isComposerQueueResult({ ok: true, outboxCount: 1, screenshotDropped: 'yes' })).toBe(false);
    expect(isComposerQueueResult(null)).toBe(false);
  });

  it('accepts both count result shapes', () => {
    expect(isOutboxCountResult({ ok: true, count: 0 })).toBe(true);
    expect(isOutboxCountResult({ ok: false, error: 'nope' })).toBe(true);
    expect(isOutboxCountResult({ ok: true, count: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isOutboxCountResult({ ok: true, count: '3' })).toBe(false);
  });

  it('accepts both remove result shapes', () => {
    expect(isComposerRemoveResult({ ok: true, elementCount: 2 })).toBe(true);
    expect(isComposerRemoveResult({ ok: false, error: 'nope' })).toBe(true);
    expect(isComposerRemoveResult({ ok: true })).toBe(false);
    expect(isComposerRemoveResult({ ok: true, elementCount: -1 })).toBe(false);
    expect(isComposerRemoveResult(null)).toBe(false);
  });
});
