import type { PickerFeedback } from '@/lib/picker/facts';
import type { CaptureResult } from '@/lib/picker/protocol';
import type { ComposerPageRequest, ComposerQueueResult } from './protocol';

export const NO_PICKED_ELEMENT_ERROR = 'No picked element to comment on';

export interface ElementSubmissionDeps {
  notify: (feedback: PickerFeedback) => Promise<CaptureResult>;
  send: (input: { comment: string; page: ComposerPageRequest; captureID: string }) => Promise<ComposerQueueResult>;
}

export interface ElementSubmission {
  track: (feedback: PickerFeedback) => void;
  submit: (comment: string, page: ComposerPageRequest) => Promise<ComposerQueueResult>;
}

export function createElementSubmission(deps: ElementSubmissionDeps): ElementSubmission {
  let latest: { captureID: string; result: Promise<CaptureResult> } | null = null;

  function track(feedback: PickerFeedback): void {
    const result = deps.notify(feedback);
    latest = { captureID: feedback.id, result };
    void result.then((outcome) => {
      if (!outcome.ok) console.warn(`Browsertalk: ${outcome.error}`);
    });
  }

  async function submit(comment: string, page: ComposerPageRequest): Promise<ComposerQueueResult> {
    const capture = latest;
    if (capture === null) return { ok: false, error: NO_PICKED_ELEMENT_ERROR };

    const outcome = await capture.result;
    if (!outcome.ok) return { ok: false, error: outcome.error };

    return deps.send({ comment, page, captureID: capture.captureID });
  }

  return { track, submit };
}
