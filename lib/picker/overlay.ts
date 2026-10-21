import { formatElementLabel } from './collect';
import { createOverlayHolds } from './overlay-visibility';
import { formatPickCount } from './pill-copy';

export const PICKER_OVERLAY_ID = 'browsertalk-picker-overlay';
export const PICKER_COUNT_ID = 'browsertalk-picker-count';

const ACCENT = '#4f46e5';
const ACCENT_SOFT = 'rgba(79, 70, 229, 0.12)';
const PILL_BACKGROUND = '#1c1c1e';
const PILL_TEXT = '#f2f2f7';

export interface PickerOverlayState {
  picks: Element[];
  hovered: Element | null;
  modifier: string;
}

export interface PickerOverlay {
  mount: () => void;
  unmount: () => void;
  render: (state: PickerOverlayState) => void;
  contains: (target: EventTarget | null) => boolean;
  withHidden: <T>(operation: () => Promise<T>) => Promise<T>;
}

export function createPickerOverlay(onClear: () => void): PickerOverlay {
  let host: HTMLDivElement | null = null;
  let boxes: HTMLDivElement | null = null;
  let hoverBox: HTMLDivElement | null = null;
  let hoverLabel: HTMLDivElement | null = null;
  let pill: HTMLDivElement | null = null;
  let clearButton: HTMLButtonElement | null = null;

  const holds = createOverlayHolds({
    hide: () => applyHidden(true),
    show: () => applyHidden(false),
  });

  function applyHidden(hidden: boolean): void {
    const value = hidden ? 'hidden' : '';
    if (host !== null) host.style.visibility = value;
    if (pill !== null) pill.style.visibility = value;
  }

  function mount(): void {
    if (host !== null) return;
    build();
    if (holds.count() > 0) applyHidden(true);
  }

  function unmount(): void {
    host?.remove();
    host = null;
    boxes = null;
    hoverBox = null;
    hoverLabel = null;
    pill = null;
    clearButton = null;
  }

  function contains(target: EventTarget | null): boolean {
    return target instanceof Node && host !== null && host.contains(target);
  }

  function render(state: PickerOverlayState): void {
    if (host === null) return;
    renderSelected(state.picks);
    renderHover(state);
    renderPill(state.picks.length, state.modifier);
  }

  function renderSelected(picks: Element[]): void {
    if (boxes === null) return;
    boxes.textContent = '';

    picks.forEach((element, position) => {
      if (!element.isConnected) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const box = document.createElement('div');
      box.style.position = 'fixed';
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.border = `2px solid ${ACCENT}`;
      box.style.background = ACCENT_SOFT;
      box.style.borderRadius = '4px';
      box.style.pointerEvents = 'none';

      const badge = document.createElement('div');
      badge.textContent = String(position + 1);
      badge.style.position = 'absolute';
      badge.style.top = '-10px';
      badge.style.left = '-10px';
      badge.style.width = '20px';
      badge.style.height = '20px';
      badge.style.borderRadius = '50%';
      badge.style.background = ACCENT;
      badge.style.color = '#ffffff';
      badge.style.font = '600 11px/20px ui-monospace, SFMono-Regular, Menlo, monospace';
      badge.style.textAlign = 'center';
      badge.style.boxShadow = '0 1px 5px rgba(0, 0, 0, 0.3)';

      box.append(badge);
      boxes?.append(box);
    });
  }

  function renderHover(state: PickerOverlayState): void {
    if (hoverBox === null || hoverLabel === null) return;

    const candidate = state.hovered;
    const selected = candidate !== null && state.picks.some((element) => element === candidate);
    if (candidate === null || !candidate.isConnected || selected) {
      hideHover();
      return;
    }

    const rect = candidate.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideHover();
      return;
    }

    hoverBox.style.display = 'block';
    hoverBox.style.left = `${rect.left}px`;
    hoverBox.style.top = `${rect.top}px`;
    hoverBox.style.width = `${rect.width}px`;
    hoverBox.style.height = `${rect.height}px`;

    hoverLabel.style.display = 'block';
    hoverLabel.textContent = formatElementLabel(
      candidate.tagName.toLowerCase(),
      candidate.id.length > 0 ? candidate.id : null,
      Array.from(candidate.classList),
    );
    hoverLabel.style.left = `${Math.max(0, rect.left)}px`;
    hoverLabel.style.top = rect.top > 24 ? `${rect.top - 20}px` : `${rect.bottom + 4}px`;
  }

  function hideHover(): void {
    if (hoverBox !== null) hoverBox.style.display = 'none';
    if (hoverLabel !== null) hoverLabel.style.display = 'none';
  }

  function renderPill(count: number, modifier: string): void {
    if (pill === null || clearButton === null) return;
    if (count === 0) {
      pill.style.display = 'none';
      return;
    }

    pill.style.display = 'flex';
    const dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.background = ACCENT;

    const text = document.createElement('span');
    text.textContent = formatPickCount(count, modifier);
    pill.textContent = '';
    pill.append(dot, text, clearButton);
  }

  function build(): void {
    host = document.createElement('div');
    host.id = PICKER_OVERLAY_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483647';

    boxes = document.createElement('div');
    boxes.style.position = 'fixed';
    boxes.style.inset = '0';
    boxes.style.pointerEvents = 'none';

    hoverBox = document.createElement('div');
    hoverBox.style.position = 'fixed';
    hoverBox.style.display = 'none';
    hoverBox.style.border = `1px dashed ${ACCENT}`;
    hoverBox.style.background = ACCENT_SOFT;
    hoverBox.style.borderRadius = '3px';
    hoverBox.style.pointerEvents = 'none';

    hoverLabel = document.createElement('div');
    hoverLabel.style.position = 'fixed';
    hoverLabel.style.display = 'none';
    hoverLabel.style.background = ACCENT;
    hoverLabel.style.color = '#ffffff';
    hoverLabel.style.font = '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace';
    hoverLabel.style.padding = '2px 6px';
    hoverLabel.style.borderRadius = '4px';
    hoverLabel.style.whiteSpace = 'nowrap';
    hoverLabel.style.overflow = 'hidden';
    hoverLabel.style.textOverflow = 'ellipsis';
    hoverLabel.style.maxWidth = '60vw';
    hoverLabel.style.pointerEvents = 'none';

    pill = document.createElement('div');
    pill.id = PICKER_COUNT_ID;
    pill.style.position = 'fixed';
    pill.style.left = '50%';
    pill.style.bottom = '22px';
    pill.style.transform = 'translateX(-50%)';
    pill.style.display = 'none';
    pill.style.alignItems = 'center';
    pill.style.gap = '8px';
    pill.style.padding = '8px 8px 8px 14px';
    pill.style.borderRadius = '999px';
    pill.style.background = PILL_BACKGROUND;
    pill.style.color = PILL_TEXT;
    pill.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.28)';
    pill.style.font = '12px/1.2 ui-sans-serif, system-ui, sans-serif';
    pill.style.whiteSpace = 'nowrap';
    pill.style.pointerEvents = 'auto';

    clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear';
    clearButton.style.border = '1px solid #3a3a3c';
    clearButton.style.background = 'transparent';
    clearButton.style.color = '#d1d1d6';
    clearButton.style.padding = '3px 9px';
    clearButton.style.borderRadius = '999px';
    clearButton.style.font = 'inherit';
    clearButton.style.cursor = 'pointer';
    clearButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClear();
    });

    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = '* { cursor: crosshair !important; }';

    host.append(boxes, hoverBox, hoverLabel, pill, cursorStyle);
    document.documentElement.append(host);
  }

  return { mount, unmount, render, contains, withHidden: holds.guard };
}
