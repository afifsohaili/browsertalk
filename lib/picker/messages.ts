import { browser } from 'wxt/browser';
import type { PickerFeedback } from './facts';
import {
  isArmPickerResult,
  isCaptureResult,
  type ArmPickerResult,
  type CaptureResult,
  type PickerMessage,
} from './protocol';

const BACKGROUND_UNAVAILABLE = 'Background unavailable';

export async function requestArmPicker(): Promise<ArmPickerResult> {
  const response = await sendSafely({ type: 'picker/arm' });
  return isArmPickerResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function notifyCaptured(feedback: PickerFeedback, elementIndex: number): Promise<CaptureResult> {
  const response = await sendSafely({ type: 'picker/captured', feedback, elementIndex });
  return isCaptureResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

export async function notifyCleared(setID: string): Promise<CaptureResult> {
  const response = await sendSafely({ type: 'picker/cleared', setID });
  return isCaptureResult(response) ? response : { ok: false, error: BACKGROUND_UNAVAILABLE };
}

async function sendSafely(message: PickerMessage): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
}
