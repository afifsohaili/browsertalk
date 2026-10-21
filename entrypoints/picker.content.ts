import { browser } from 'wxt/browser';
import { formatChipLabel } from '@/lib/composer/chips';
import { createElementSubmission } from '@/lib/composer/element-submission';
import { requestQueueComment, requestRemoveElement } from '@/lib/composer/messages';
import { createComposerSession } from '@/lib/composer/session';
import type { PickerFeedback } from '@/lib/picker/facts';
import { notifyCaptured, notifyCleared } from '@/lib/picker/messages';
import { isPickerMessage, type ArmPickerResult } from '@/lib/picker/protocol';
import { createPickerSession } from '@/lib/picker/session';

function chipLabel(feedback: PickerFeedback): string {
  const facts = feedback.elements[0]?.element;
  return facts === undefined ? 'element' : formatChipLabel(facts);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let withOverlayHidden: <T>(operation: () => Promise<T>) => Promise<T> = (operation) => operation();

    const submission = createElementSubmission({
      notify: (feedback, index) => withOverlayHidden(() => notifyCaptured(feedback, index)),
      remove: requestRemoveElement,
      send: ({ comment, page, captureID, elementCount }) =>
        requestQueueComment(comment, page, captureID, elementCount),
    });

    let endSet = (): void => {};

    const composer = createComposerSession({
      queue: async (comment, elementCount) => {
        const page = { url: window.location.href, title: document.title };
        return submission.submit(comment, page, elementCount);
      },
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
        if (setID !== null) void notifyCleared(setID);
      },
      onRouteChange: () => composer.close(),
    });

    endSet = session.end;
    withOverlayHidden = session.withOverlayHidden;

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (isPickerMessage(message) && message.type === 'picker/arm') {
        const wasArmed = session.isArmed();
        if (!wasArmed) composer.close();
        const armed = session.toggle();
        if (armed && !wasArmed) submission.clear();
        sendResponse({ ok: true, armed } satisfies ArmPickerResult);
        return undefined;
      }

      return undefined;
    });
  },
});
