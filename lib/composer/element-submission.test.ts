import { describe, expect, it, vi } from 'vitest';
import type { PickerFeedback } from '@/lib/picker/facts';
import type { CaptureResult } from '@/lib/picker/protocol';
import type { ComposerPageRequest, ComposerQueueResult, ComposerRemoveResult } from './protocol';
import { createElementSubmission, NO_PICKED_ELEMENT_ERROR } from './element-submission';

const PAGE: ComposerPageRequest = { url: 'https://example.com/cart', title: 'Cart' };
const SET_ID = 'fb_set';

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
    notify: vi.fn(async (_feedback: PickerFeedback, _index: number) => ({ ok: true }) as CaptureResult),
    send: vi.fn(
      async (_input: {
        comment: string;
        page: ComposerPageRequest;
        captureID: string;
        elementCount: number;
      }) => ({ ok: true, outboxCount: 1 }) as ComposerQueueResult,
    ),
    remove: vi.fn(
      async (_captureID: string, _index: number) => ({ ok: true, elementCount: 1 }) as ComposerRemoveResult,
    ),
  };
}

describe('element submission', () => {
  it('queues the capture id with the set count after the capture settles', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    const pick = feedback('fb_a');

    submission.track(pick, 0);

    await expect(submission.submit('Fix this', PAGE, 1)).resolves.toEqual({ ok: true, outboxCount: 1 });
    expect(stub.notify).toHaveBeenCalledWith(pick, 0);
    expect(stub.send).toHaveBeenCalledWith({
      comment: 'Fix this',
      page: PAGE,
      captureID: 'fb_a',
      elementCount: 1,
    });
  });

  it('does not submit when the capture was rejected', async () => {
    const stub = deps();
    stub.notify.mockResolvedValueOnce({ ok: false, error: 'The captured feedback was invalid' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const submission = createElementSubmission(stub);

    submission.track(feedback('fb_a'), 0);

    await expect(submission.submit('Fix this', PAGE, 1)).resolves.toEqual({
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
    submission.track(feedback('fb_a'), 0);

    let settled = false;
    const pending = submission.submit('Fix this', PAGE, 1).then((result) => {
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

    await expect(submission.submit('Fix this', PAGE, 1)).resolves.toEqual({
      ok: false,
      error: NO_PICKED_ELEMENT_ERROR,
    });
    expect(stub.send).not.toHaveBeenCalled();
  });

  it('submits the latest capture when a second pick replaces the first', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback('fb_a'), 0);
    submission.track(feedback('fb_b'), 0);

    await submission.submit('Fix this', PAGE, 1);

    expect(stub.notify).toHaveBeenLastCalledWith(feedback('fb_b'), 0);
    expect(stub.send).toHaveBeenCalledWith({ comment: 'Fix this', page: PAGE, captureID: 'fb_b', elementCount: 1 });
  });

  it('awaits every tracked capture and sends the set id and count', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    await expect(submission.submit('Both', PAGE, 2)).resolves.toEqual({ ok: true, outboxCount: 1 });

    expect(stub.notify.mock.calls.map(([, index]) => index)).toEqual([0, 1]);
    expect(stub.send).toHaveBeenCalledWith({ comment: 'Both', page: PAGE, captureID: SET_ID, elementCount: 2 });
  });

  it('awaits every capture even when the picks arrive out of order', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 2);
    submission.track(feedback(SET_ID), 0);

    await submission.submit('Both', PAGE, 2);

    expect(stub.notify.mock.calls.map(([, index]) => index)).toEqual([2, 0]);
    expect(stub.send).toHaveBeenCalledWith({ comment: 'Both', page: PAGE, captureID: SET_ID, elementCount: 2 });
  });

  it('fails on the first capture error and sends nothing', async () => {
    const stub = deps();
    stub.notify.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'Capture failed' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    await expect(submission.submit('Both', PAGE, 2)).resolves.toEqual({ ok: false, error: 'Capture failed' });
    expect(stub.send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('removes the chip from the background set with its pick index', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    await expect(submission.remove(1)).resolves.toEqual({ ok: true, elementCount: 1 });

    expect(stub.remove).toHaveBeenCalledWith(SET_ID, 1);
  });

  it('drops a removed chip from the awaited set', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    await submission.remove(1);

    await submission.submit('Only the first', PAGE, 1);

    expect(stub.send).toHaveBeenCalledWith({
      comment: 'Only the first',
      page: PAGE,
      captureID: SET_ID,
      elementCount: 1,
    });
  });

  it('keeps a chip whose background removal was refused', async () => {
    const stub = deps();
    stub.remove.mockResolvedValueOnce({ ok: false, error: 'No picked element to comment on' });
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    await expect(submission.remove(1)).resolves.toEqual({
      ok: false,
      error: 'No picked element to comment on',
    });

    await submission.submit('Both', PAGE, 2);
    expect(stub.send).toHaveBeenCalledWith({ comment: 'Both', page: PAGE, captureID: SET_ID, elementCount: 2 });
  });

  it('refuses to remove an index it never tracked', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);

    await expect(submission.remove(3)).resolves.toEqual({ ok: false, error: NO_PICKED_ELEMENT_ERROR });
    expect(stub.remove).not.toHaveBeenCalled();
  });

  it('refuses to submit after the only chip is removed', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback('fb_a'), 0);

    await submission.remove(0);

    await expect(submission.submit('Fix this', PAGE, 0)).resolves.toEqual({
      ok: false,
      error: NO_PICKED_ELEMENT_ERROR,
    });
    expect(stub.send).not.toHaveBeenCalled();
  });

  it('forgets every capture when the picker starts a new set', async () => {
    const stub = deps();
    const submission = createElementSubmission(stub);
    submission.track(feedback(SET_ID), 0);
    submission.track(feedback(SET_ID), 1);

    submission.clear();

    await expect(submission.submit('Fix this', PAGE, 1)).resolves.toEqual({
      ok: false,
      error: NO_PICKED_ELEMENT_ERROR,
    });
    expect(stub.send).not.toHaveBeenCalled();
  });
});
