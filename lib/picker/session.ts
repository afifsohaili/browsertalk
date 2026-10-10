import { assembleFeedback, formatElementLabel } from './collect';
import type { PickerFeedback } from './facts';
import { readCapture } from './read';

export const PICKER_OVERLAY_ID = 'browsertalk-picker-overlay';

export interface PickerSession {
  isArmed(): boolean;
  toggle(): boolean;
  disarm(): void;
}

export function createPickerSession(onPick: (feedback: PickerFeedback) => void): PickerSession {
  let armed = false;
  let hovered: Element | null = null;
  let host: HTMLDivElement | null = null;
  let highlight: HTMLDivElement | null = null;
  let label: HTMLDivElement | null = null;
  let previousCursor = '';

  function arm(): void {
    if (armed) return;
    armed = true;
    previousCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';
    buildOverlay();
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange, true);
    window.addEventListener('blur', disarm);
  }

  function disarm(): void {
    if (!armed) return;
    armed = false;
    hovered = null;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange, true);
    window.removeEventListener('blur', disarm);
    document.documentElement.style.cursor = previousCursor;
    host?.remove();
    host = null;
    highlight = null;
    label = null;
  }

  function toggle(): boolean {
    if (armed) disarm();
    else arm();
    return armed;
  }

  function onMouseMove(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    hovered = target;
    renderOverlay(target);
  }

  function onClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    const feedback =
      target instanceof Element
        ? assembleFeedback(readCapture(target), {
            id: crypto.randomUUID(),
            capturedAt: new Date().toISOString(),
          })
        : null;
    disarm();
    if (feedback !== null) onPick(feedback);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    disarm();
  }

  function onViewportChange(): void {
    renderOverlay(hovered);
  }

  function buildOverlay(): void {
    host = document.createElement('div');
    host.id = PICKER_OVERLAY_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483647';

    highlight = document.createElement('div');
    highlight.style.position = 'fixed';
    highlight.style.display = 'none';
    highlight.style.border = '2px solid #4f46e5';
    highlight.style.background = 'rgba(79, 70, 229, 0.12)';
    highlight.style.borderRadius = '3px';

    label = document.createElement('div');
    label.style.position = 'fixed';
    label.style.display = 'none';
    label.style.background = '#4f46e5';
    label.style.color = '#ffffff';
    label.style.font = '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '4px';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.maxWidth = '60vw';

    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = '* { cursor: crosshair !important; }';

    host.append(highlight, label, cursorStyle);
    document.documentElement.append(host);
  }

  function renderOverlay(target: Element | null): void {
    if (highlight === null || label === null) return;
    if (target === null) {
      highlight.style.display = 'none';
      label.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;

    label.style.display = 'block';
    label.textContent = formatElementLabel(
      target.tagName.toLowerCase(),
      elementId(target),
      Array.from(target.classList),
    );
    label.style.left = `${Math.max(0, rect.left)}px`;
    label.style.top = rect.top > 24 ? `${rect.top - 20}px` : `${rect.bottom + 4}px`;
  }

  return { isArmed: () => armed, toggle, disarm };
}

function elementId(element: Element): string | null {
  return element.id.length > 0 ? element.id : null;
}
