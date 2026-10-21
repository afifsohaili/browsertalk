import { browser } from 'wxt/browser';
import { requestQueueComment, requestRemoveElement } from '@/lib/composer/messages';
import { notifyCaptured, notifyCleared } from '@/lib/picker/messages';
import { isPickerMessage, type ArmPickerResult } from '@/lib/picker/protocol';
import { createPickerWiring } from '@/lib/picker/wiring';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const wiring = createPickerWiring({
      notifyCaptured,
      removeElement: requestRemoveElement,
      queueComment: requestQueueComment,
      notifyCleared,
      page: () => ({ url: window.location.href, title: document.title }),
    });

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (isPickerMessage(message) && message.type === 'picker/arm') {
        const armed = wiring.arm();
        sendResponse({ ok: true, armed } satisfies ArmPickerResult);
        return undefined;
      }

      return undefined;
    });
  },
});
