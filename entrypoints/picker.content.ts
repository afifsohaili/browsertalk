import { browser } from 'wxt/browser';
import { requestQueueComment } from '@/lib/composer/messages';
import { isComposerRequest } from '@/lib/composer/protocol';
import { createComposerSession } from '@/lib/composer/session';
import { notifyCaptured } from '@/lib/picker/messages';
import { isPickerMessage, type ArmPickerResult } from '@/lib/picker/protocol';
import { createPickerSession } from '@/lib/picker/session';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let captured: Promise<unknown> = Promise.resolve();

    const composer = createComposerSession({
      queue: async (comment, mode) => {
        if (mode === 'element') await captured;
        return requestQueueComment(comment, mode, { url: window.location.href, title: document.title });
      },
    });

    const session = createPickerSession((feedback, element) => {
      captured = notifyCaptured(feedback).then((result) => {
        if (!result.ok) console.warn(`Browsertalk: ${result.error}`);
      });
      composer.openElement(element);
    });

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (isPickerMessage(message) && message.type === 'picker/arm') {
        sendResponse({ ok: true, armed: session.toggle() } satisfies ArmPickerResult);
        return undefined;
      }

      if (isComposerRequest(message) && message.type === 'composer/open') {
        composer.openPage();
        sendResponse({ ok: true });
        return undefined;
      }

      return undefined;
    });
  },
});
