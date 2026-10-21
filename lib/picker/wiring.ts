import { formatChipLabel } from '@/lib/composer/chips';
import { createElementSubmission, type ElementSubmission } from '@/lib/composer/element-submission';
import type { ComposerPageRequest, ComposerQueueResult, ComposerRemoveResult } from '@/lib/composer/protocol';
import { createComposerSession, type ComposerSession } from '@/lib/composer/session';
import type { PickerFeedback } from './facts';
import type { CaptureResult } from './protocol';
import { createPickerSession, type PickerSession } from './session';

export interface PickerWiringDeps {
  notifyCaptured: (feedback: PickerFeedback, elementIndex: number) => Promise<CaptureResult>;
  removeElement: (captureID: string, index: number) => Promise<ComposerRemoveResult>;
  queueComment: (
    comment: string,
    page: ComposerPageRequest,
    captureID: string,
    elementCount: number,
  ) => Promise<ComposerQueueResult>;
  notifyCleared: (setID: string) => Promise<unknown>;
  page: () => ComposerPageRequest;
}

export interface PickerWiring {
  session: PickerSession;
  composer: ComposerSession;
  submission: ElementSubmission;
  arm: () => boolean;
}

export function createPickerWiring(deps: PickerWiringDeps): PickerWiring {
  let withOverlayHidden: PickerSession['withOverlayHidden'] = (operation) => operation();

  const submission = createElementSubmission({
    notify: (feedback, index) => withOverlayHidden(() => deps.notifyCaptured(feedback, index)),
    remove: deps.removeElement,
    send: ({ comment, page, captureID, elementCount }) =>
      deps.queueComment(comment, page, captureID, elementCount),
  });

  let endSet = (): void => {};

  const composer = createComposerSession({
    queue: (comment, elementCount) => submission.submit(comment, deps.page(), elementCount),
    remove: (index) => submission.remove(index),
    onClose: () => endSet(),
  });

  const session = createPickerSession({
    onPick: (feedback, index) => submission.track(feedback, index),
    onFinish: ({ picks, anchor }) => {
      composer.openSet({
        anchor,
        elements: picks.map((pick) => ({
          element: pick.element,
          index: pick.index,
          label: chipLabel(pick.feedback),
        })),
      });
    },
    onRemove: (_setID, index) => {
      void submission.remove(index);
    },
    onClear: (setID) => {
      submission.clear();
      if (setID !== null) void deps.notifyCleared(setID);
    },
    onRouteChange: () => composer.close(),
  });

  endSet = session.end;
  withOverlayHidden = session.withOverlayHidden;

  function arm(): boolean {
    const wasArmed = session.isArmed();
    if (!wasArmed) composer.close();
    const armed = session.toggle();
    if (armed && !wasArmed) submission.clear();
    return armed;
  }

  return { session, composer, submission, arm };
}

function chipLabel(feedback: PickerFeedback): string {
  const facts = feedback.elements[0]?.element;
  return facts === undefined ? 'element' : formatChipLabel(facts);
}
