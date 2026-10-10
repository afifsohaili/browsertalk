import { browser } from 'wxt/browser';
import { setPendingFeedback } from '@/lib/storage/pending';
import { isPickerFeedback, type PickerFeedback } from './facts';
import {
  isArmPickerResult,
  isCaptureResult,
  isPickerMessage,
  type ArmPickerResult,
  type CaptureResult,
  type PickerMessage,
} from './protocol';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';
const NO_ACTIVE_PAGE = 'No active page to arm the picker on';
const NO_CONTENT_SCRIPT = "Can't arm the picker on this page";
const INVALID_CAPTURE = 'The captured feedback was invalid';
const CONTEXT_MENU_ID = 'arm-picker';

export async function respondToPickerRequest(request: PickerMessage): Promise<ArmPickerResult | CaptureResult> {
  switch (request.type) {
    case 'picker/arm':
      return armPickerOnActiveTab();
    case 'picker/captured': {
      if (!isPickerFeedback(request.feedback)) return { ok: false, error: INVALID_CAPTURE };
      await setPendingFeedback(request.feedback);
      return { ok: true };
    }
  }
}

export function registerPickerMessageHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isPickerMessage(message)) return undefined;

    respondToPickerRequest(message).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies CaptureResult);
    });
    return true;
  });
}

export function registerPickerTriggers(): void {
  browser.commands.onCommand.addListener((command) => {
    if (command !== 'arm-picker') return;
    void armPickerOnActiveTab().then(reportFailure);
  });

  void browser.contextMenus
    .removeAll()
    .then(() =>
      browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'Browsertalk: point at element',
        contexts: ['all'],
      }),
    )
    .catch((error: unknown) => {
      console.warn('Browsertalk: context menu setup failed', error);
    });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    const tabId = tab?.id;
    if (tabId === undefined) {
      reportFailure({ ok: false, error: NO_ACTIVE_PAGE });
      return;
    }
    void armPickerOnTab(tabId).then(reportFailure);
  });
}

export async function armPickerOnActiveTab(): Promise<ArmPickerResult> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (tabId === undefined) return { ok: false, error: NO_ACTIVE_PAGE };
  return armPickerOnTab(tabId);
}

export async function armPickerOnTab(tabId: number): Promise<ArmPickerResult> {
  try {
    const response = await browser.tabs.sendMessage(tabId, { type: 'picker/arm' } satisfies PickerMessage);
    return isArmPickerResult(response) ? response : { ok: false, error: NO_CONTENT_SCRIPT };
  } catch {
    return { ok: false, error: NO_CONTENT_SCRIPT };
  }
}

export async function requestArmPicker(): Promise<ArmPickerResult> {
  const response = await sendSafely({ type: 'picker/arm' });
  return isArmPickerResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function notifyCaptured(feedback: PickerFeedback): Promise<CaptureResult> {
  const response = await sendSafely({ type: 'picker/captured', feedback });
  return isCaptureResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

function reportFailure(result: ArmPickerResult): void {
  if (!result.ok) console.warn(`Browsertalk: ${result.error}`);
}

async function sendSafely(message: PickerMessage): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}
