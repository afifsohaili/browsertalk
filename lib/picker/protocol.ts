import { isRecord } from './facts';

export type PickerMessage =
  | { type: 'picker/arm' }
  | { type: 'picker/captured'; feedback: unknown; elementIndex: number };

export type ArmPickerResult = { ok: true; armed: boolean } | { ok: false; error: string };

export type CaptureResult = { ok: true } | { ok: false; error: string };

export function isPickerMessage(value: unknown): value is PickerMessage {
  if (!isRecord(value)) return false;
  return value.type === 'picker/arm' || value.type === 'picker/captured';
}

export function isElementIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isArmPickerResult(value: unknown): value is ArmPickerResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return typeof value.armed === 'boolean';
  if (value.ok === false) return typeof value.error === 'string';
  return false;
}

export function isCaptureResult(value: unknown): value is CaptureResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return true;
  if (value.ok === false) return typeof value.error === 'string';
  return false;
}
