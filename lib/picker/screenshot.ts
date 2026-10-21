import type { CaptureBudget } from './capture-budget';
import type { PickerBoxFacts, PickerFeedback, PickerScreenshotFacts, PickerSizeFacts } from './facts';
import { MAX_SCREENSHOT_BYTES } from './limits';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface ScreenshotRequest {
  windowId: number | undefined;
  isVisible: () => Promise<boolean>;
}

export interface ElementScreenshotter {
  captureFor(
    feedback: PickerFeedback,
    request: ScreenshotRequest,
    options?: CaptureOptions,
  ): Promise<PickerScreenshotFacts | null>;
}

export interface CaptureOptions {
  allowWait?: boolean;
}

export interface ScreenshotDeps {
  captureTab: (windowId: number | undefined) => Promise<string>;
  crop: (dataUrl: string, box: PickerBoxFacts, viewport: PickerSizeFacts) => Promise<PickerScreenshotFacts | null>;
  budget: CaptureBudget;
}

export function computeCropRect(box: PickerBoxFacts, viewport: PickerSizeFacts, image: ImageSize): CropRect | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null;
  if (image.width <= 0 || image.height <= 0) return null;
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const left = clamp(Math.floor(box.x * scaleX), 0, image.width);
  const top = clamp(Math.floor(box.y * scaleY), 0, image.height);
  const right = clamp(Math.ceil((box.x + box.width) * scaleX), 0, image.width);
  const bottom = clamp(Math.ceil((box.y + box.height) * scaleY), 0, image.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

export function createElementScreenshotter(deps: ScreenshotDeps): ElementScreenshotter {
  return {
    async captureFor(feedback, request, options = {}) {
      const first = feedback.elements[0];
      if (first === undefined) return null;
      const { box, viewport } = first.element;
      if (box.width <= 0 || box.height <= 0) return null;

      if (options.allowWait === true) {
        if (!(await deps.budget.waitForToken())) return null;
      } else if (!deps.budget.tryAcquire()) {
        return null;
      }

      try {
        if (!(await request.isVisible())) return null;
        const dataUrl = await deps.captureTab(request.windowId);
        return await deps.crop(dataUrl, box, viewport);
      } catch {
        return null;
      }
    },
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = comma === -1 ? '' : dataUrl.slice(0, comma);
  const base64 = comma === -1 ? '' : dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const match = /data:([^;,]+)/.exec(header);
  return new Blob([bytes], { type: match?.[1] ?? 'image/png' });
}

export async function cropScreenshot(
  dataUrl: string,
  box: PickerBoxFacts,
  viewport: PickerSizeFacts,
): Promise<PickerScreenshotFacts | null> {
  const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
  try {
    const rect = computeCropRect(box, viewport, { width: bitmap.width, height: bitmap.height });
    if (rect === null) return null;
    const canvas = new OffscreenCanvas(rect.width, rect.height);
    const context = canvas.getContext('2d');
    if (context === null) return null;
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    const crop = await canvas.convertToBlob({ type: 'image/png' });
    if (crop.size > MAX_SCREENSHOT_BYTES) return null;
    return { dataUrl: await blobToDataUrl(crop), width: rect.width, height: rect.height };
  } finally {
    bitmap.close();
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
