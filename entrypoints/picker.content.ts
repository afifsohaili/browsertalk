import { browser } from 'wxt/browser';
import { createElementSubmission } from '@/lib/composer/element-submission';
import { requestQueueComment } from '@/lib/composer/messages';
import { createComposerSession } from '@/lib/composer/session';
import { notifyCaptured } from '@/lib/picker/messages';
import { isPickerMessage, type ArmPickerResult } from '@/lib/picker/protocol';
import { createPickerSession } from '@/lib/picker/session';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const submission = createElementSubmission({
      notify: notifyCaptured,
      send: ({ comment, page, captureID }) => requestQueueComment(comment, page, captureID),
    });

    const composer = createComposerSession({
      queue: async (comment) => {
        const page = { url: window.location.href, title: document.title };
        return submission.submit(comment, page);
      },
    });

    const session = createPickerSession((feedback, element) => {
      submission.track(feedback);
      composer.openElement(element);
    });

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (isPickerMessage(message) && message.type === 'picker/arm') {
        sendResponse({ ok: true, armed: session.toggle() } satisfies ArmPickerResult);
        return undefined;
      }

      return undefined;
    });
  },
});
