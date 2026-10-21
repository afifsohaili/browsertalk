import type { PickerFeedback } from '@/lib/picker/facts';
import type { CaptureResult } from '@/lib/picker/protocol';
import type { ComposerPageRequest, ComposerQueueResult, ComposerRemoveResult } from './protocol';

export const NO_PICKED_ELEMENT_ERROR = 'No picked element to comment on';

export interface ElementSubmissionDeps {
  notify: (feedback: PickerFeedback, index: number) => Promise<CaptureResult>;
  send: (input: {
    comment: string;
    page: ComposerPageRequest;
    captureID: string;
    elementCount: number;
  }) => Promise<ComposerQueueResult>;
  remove: (captureID: string, index: number) => Promise<ComposerRemoveResult>;
}

export interface ElementSubmission {
  track: (feedback: PickerFeedback, index: number) => void;
  remove: (index: number) => Promise<ComposerRemoveResult>;
  clear: () => void;
  submit: (comment: string, page: ComposerPageRequest, elementCount: number) => Promise<ComposerQueueResult>;
}

interface TrackedCapture {
  captureID: string;
  result: Promise<CaptureResult>;
}

export function createElementSubmission(deps: ElementSubmissionDeps): ElementSubmission {
  const captures = new Map<number, TrackedCapture>();

  function track(feedback: PickerFeedback, index: number): void {
    const result = deps.notify(feedback, index);
    captures.set(index, { captureID: feedback.id, result });
    void result.then((outcome) => {
      if (!outcome.ok) console.warn(`Browsertalk: ${outcome.error}`);
    });
  }

  function ordered(): TrackedCapture[] {
    return [...captures.entries()].sort(([left], [right]) => left - right).map(([, capture]) => capture);
  }

  async function remove(index: number): Promise<ComposerRemoveResult> {
    const capture = captures.get(index);
    if (capture === undefined) return { ok: false, error: NO_PICKED_ELEMENT_ERROR };

    const outcome = await deps.remove(capture.captureID, index);
    if (outcome.ok) captures.delete(index);
    return outcome;
  }

  async function submit(
    comment: string,
    page: ComposerPageRequest,
    elementCount: number,
  ): Promise<ComposerQueueResult> {
    const entries = ordered();
    const first = entries[0];
    if (first === undefined) return { ok: false, error: NO_PICKED_ELEMENT_ERROR };

    for (const capture of entries) {
      const outcome = await capture.result;
      if (!outcome.ok) return { ok: false, error: outcome.error };
    }

    return deps.send({ comment, page, captureID: first.captureID, elementCount });
  }

  return { track, remove, clear: () => captures.clear(), submit };
}
