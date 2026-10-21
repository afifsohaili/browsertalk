import { BACKGROUND_UNAVAILABLE, sendSafely } from '@/lib/runtime-message';
import type { PickerFeedback } from './facts';
import {
  isArmPickerResult,
  isCaptureResult,
  type ArmPickerResult,
  type CaptureResult,
} from './protocol';

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
