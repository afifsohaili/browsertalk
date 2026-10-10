import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { OutboxItem } from '@/lib/storage/outbox';
import { appendToOutbox } from '@/lib/storage/writer';
import { broadcastOutboxChanged, registerComposerHandler } from './messages';
import { useOutboxCount } from './use-outbox';

function item(comment: string): OutboxItem {
  return {
    id: `ob_${comment}`,
    comment,
    capturedAt: '2026-10-10T09:00:00.000Z',
    status: 'queued',
    facts: { page: { url: 'https://example.com/', path: '/', query: [], title: 'Example' } },
  };
}

describe('useOutboxCount', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    registerComposerHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the queued count on start', async () => {
    await appendToOutbox(item('a'));
    await appendToOutbox(item('b'));

    const scope = effectScope();
    const outbox = scope.run(() => useOutboxCount())!;

    await vi.waitFor(() => {
      expect(outbox.count.value).toBe(2);
    });
    scope.stop();
  });

  it('refreshes when the background announces a queued item', async () => {
    const scope = effectScope();
    const outbox = scope.run(() => useOutboxCount())!;
    await outbox.refresh();

    await appendToOutbox(item('a'));
    broadcastOutboxChanged();

    await vi.waitFor(() => {
      expect(outbox.count.value).toBe(1);
    });
    scope.stop();
  });

  it('keeps the last count when the background is not there', async () => {
    fakeBrowser.reset();

    const scope = effectScope();
    const outbox = scope.run(() => useOutboxCount())!;

    await outbox.refresh();

    expect(outbox.count.value).toBe(0);
    scope.stop();
  });

  it('stops listening when the scope stops', async () => {
    const scope = effectScope();
    const outbox = scope.run(() => useOutboxCount())!;
    await outbox.refresh();
    scope.stop();

    await appendToOutbox(item('a'));
    broadcastOutboxChanged();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(outbox.count.value).toBe(0);
  });
});
