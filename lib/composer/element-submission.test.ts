import { describe, expect, it, vi } from 'vitest';
import type { PickerFeedback } from '@/lib/picker/facts';
import type { CaptureResult } from '@/lib/picker/protocol';
import type { ComposerPageRequest, ComposerQueueResult } from './protocol';
import { createElementSubmission, NO_PICKED_ELEMENT_ERROR } from './element-submission';

const PAGE: ComposerPageRequest = { url: 'https://example.com/cart', title: 'Cart' };

function feedback(id: string): PickerFeedback {
  return {
    id,
    capturedAt: '2026-10-10T09:00:00.000Z',
    page: { url: PAGE.url, path: '/cart', query: [], title: PAGE.title },
    elements: [
      {
        element: {
          tag: 'button',
          id: 'checkout',
          classes: [],
          selector: 'button#checkout',
          text: 'Checkout',
          attributes: {},
          box: { x: 0, y: 0, width: 10, height: 10 },
          viewport: { width: 1280, height: 800 },
          scroll: { x: 0, y: 0 },
        },
      },
    ],
  };
}

function deps() {
  return {
    notify: vi.fn(async () => ({ ok: true }) as CaptureResult),
    send: vi.fn(async () => ({ ok: true, outboxCount: 1 }) as ComposerQueueResult),
  };
}

describe('element submission', () => {
  it('queues the capture id after the capture settles', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    const pick = feedback('fb_a');

    submission.track(pick);

    await expect(submission.submit('Fix this', PAGE)).resolves.toEqual({ ok: true, outboxCount: 1 });
    expect(stub.notify).toHaveBeenCalledWith(pick);
    expect(stub.send).toHaveBeenCalledWith({ comment: 'Fix this', page: PAGE, captureID: 'fb_a' });
  });

  it('does not submit when the capture was rejected', async () => {
    const stub = deps();
    stub.notify.mockResolvedValueOnce({ ok: false, error: 'The captured feedback was invalid' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const submission = createElementSubmission(stub);

    submission.track(feedback('fb_a'));

    await expect(submission.submit('Fix this', PAGE)).resolves.toEqual({
      ok: false,
      error: 'The captured feedback was invalid',
    });
    expect(stub.send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('waits for a slow capture before submitting', async () => {
    const stub = deps();
    let release: () => void = () => {};
    stub.notify.mockImplementationOnce(
      () =>
        new Promise<CaptureResult>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );
    const submission = createElementSubmission(stub);
    submission.track(feedback('fb_a'));

    let settled = false;
    const pending = submission.submit('Fix this', PAGE).then((result) => {
      settled = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    expect(stub.send).not.toHaveBeenCalled();

    release();
    await expect(pending).resolves.toEqual({ ok: true, outboxCount: 1 });
  });

  it('refuses to submit before any capture', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);

    await expect(submission.submit('Fix this', PAGE)).resolves.toEqual({
      ok: false,
      error: NO_PICKED_ELEMENT_ERROR,
    });
    expect(stub.send).not.toHaveBeenCalled();
  });

  it('submits the latest capture when a second pick replaces the first', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback('fb_a'));
    submission.track(feedback('fb_b'));

    await submission.submit('Fix this', PAGE);

    expect(stub.send).toHaveBeenCalledWith({ comment: 'Fix this', page: PAGE, captureID: 'fb_b' });
  });
});
