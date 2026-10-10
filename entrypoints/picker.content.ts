import { browser } from 'wxt/browser';
import { notifyCaptured } from '@/lib/picker/messages';
import { isPickerMessage, type ArmPickerResult } from '@/lib/picker/protocol';
import { createPickerSession } from '@/lib/picker/session';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const session = createPickerSession((feedback) => {
      void notifyCaptured(feedback).then((result) => {
        if (!result.ok) console.warn(`Browsertalk: ${result.error}`);
      });
    });

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isPickerMessage(message) || message.type !== 'picker/arm') return undefined;

      const result: ArmPickerResult = { ok: true, armed: session.toggle() };
      sendResponse(result);
      return undefined;
    });
  },
});
