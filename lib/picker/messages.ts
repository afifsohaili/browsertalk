import { browser } from 'wxt/browser';
import { CONSENT_REQUIRED_ERROR, hasConsent } from '@/lib/consent/consent';
import { clearPendingFeedback, mergePendingElement } from '@/lib/storage/pending';
import { isPickerFeedback, type PickerFeedback, type PickerScreenshotFacts } from './facts';
import {
  isArmPickerResult,
  isCaptureResult,
  isElementIndex,
  isPickerMessage,
  type ArmPickerResult,
  type CaptureResult,
  type PickerMessage,
} from './protocol';
import { createElementScreenshotter, cropScreenshot, type ElementScreenshotter } from './screenshot';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';
const NO_ACTIVE_PAGE = 'No active page to arm the picker on';
const NO_CONTENT_SCRIPT = "Can't arm the picker on this page";
const NO_SENDER_TAB = 'No page sent this capture';
const INVALID_CAPTURE = 'The captured feedback was invalid';
const INVALID_INDEX = 'The captured element index was invalid';
const CONTEXT_MENU_ID = 'arm-picker';

const defaultScreenshotter = createElementScreenshotter({
  captureTab: (windowId) =>
    windowId === undefined
      ? browser.tabs.captureVisibleTab({ format: 'png' })
      : browser.tabs.captureVisibleTab(windowId, { format: 'png' }),
  crop: cropScreenshot,
  now: () => Date.now(),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
});

let activeScreenshotter: ElementScreenshotter = defaultScreenshotter;

export function setElementScreenshotter(next: ElementScreenshotter | null): void {
  activeScreenshotter = next ?? defaultScreenshotter;
}

export interface PickerRequestContext {
  tabId?: number;
  windowId?: number;
}

export async function respondToPickerRequest(
  request: PickerMessage,
  context: PickerRequestContext = {},
): Promise<ArmPickerResult | CaptureResult> {
  switch (request.type) {
    case 'picker/arm':
      return armPickerOnActiveTab();
    case 'picker/captured': {
      if (!(await hasConsent())) return { ok: false, error: CONSENT_REQUIRED_ERROR };
      if (!isPickerFeedback(request.feedback)) return { ok: false, error: INVALID_CAPTURE };
      if (!isElementIndex(request.elementIndex)) return { ok: false, error: INVALID_INDEX };

      const tabId = context.tabId;
      if (tabId === undefined) return { ok: false, error: NO_SENDER_TAB };

      const screenshot = await activeScreenshotter.captureFor(request.feedback, {
        windowId: context.windowId,
        isVisible: () => isSenderTabVisible(tabId, context.windowId),
      });
      if (!(await hasConsent())) return { ok: false, error: CONSENT_REQUIRED_ERROR };

      await persistPendingCapture(tabId, request.feedback, request.elementIndex, screenshot);
      return { ok: true };
    }
  }
}

async function persistPendingCapture(
  tabId: number,
  feedback: PickerFeedback,
  elementIndex: number,
  screenshot: PickerScreenshotFacts | null,
): Promise<void> {
  if (screenshot === null) {
    await mergePendingElement(tabId, feedback, elementIndex);
    return;
  }
  await mergePendingElement(tabId, withScreenshot(feedback, screenshot), elementIndex, feedback);
}

async function isSenderTabVisible(tabId: number, windowId: number | undefined): Promise<boolean> {
  try {
    const query = windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId };
    const tabs = await browser.tabs.query(query);
    return tabs[0]?.id === tabId;
  } catch {
    return false;
  }
}

function withScreenshot(feedback: PickerFeedback, screenshot: PickerScreenshotFacts | null): PickerFeedback {
  if (screenshot === null) return feedback;
  const [first, ...rest] = feedback.elements;
  if (first === undefined) return feedback;
  return { ...feedback, elements: [{ ...first, extras: { ...first.extras, screenshot } }, ...rest] };
}

export function registerPickerMessageHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isPickerMessage(message)) return undefined;

    respondToPickerRequest(message, { tabId: sender.tab?.id, windowId: sender.tab?.windowId }).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'Something went wrong' } satisfies CaptureResult);
    });
    return true;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearPendingFeedback(tabId);
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
  if (!(await hasConsent())) return { ok: false, error: CONSENT_REQUIRED_ERROR };
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

export async function notifyCaptured(feedback: PickerFeedback, elementIndex: number): Promise<CaptureResult> {
  const response = await sendSafely({ type: 'picker/captured', feedback, elementIndex });
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
