import { assembleFeedback, formatElementLabel } from './collect';
import type { PickerFeedback } from './facts';
import { createOverlayHolds } from './overlay-visibility';
import { formatPickCount } from './pill-copy';
import { modifierLabel } from './platform';
import { readCapture } from './read';
import { watchWindowRoutes } from './route';
import { createPickState, pickAction } from './pick-state';

export const PICKER_OVERLAY_ID = 'browsertalk-picker-overlay';
export const PICKER_COUNT_ID = 'browsertalk-picker-count';

const ACCENT = '#4f46e5';
const ACCENT_SOFT = 'rgba(79, 70, 229, 0.12)';
const PILL_BACKGROUND = '#1c1c1e';
const PILL_TEXT = '#f2f2f7';

export interface PickerPick {
  feedback: PickerFeedback;
  element: Element;
  index: number;
}

export interface PickerFinish {
  setID: string;
  picks: PickerPick[];
  anchor: Element;
}

export interface PickerSessionOptions {
  onPick: (feedback: PickerFeedback, index: number) => void;
  onFinish: (finish: PickerFinish) => void;
  onRemove: (setID: string, index: number) => void;
  onClear: (setID: string | null) => void;
  onRouteChange: () => void;
}

export interface PickerSession {
  isArmed: () => boolean;
  toggle: () => boolean;
  disarm: () => void;
  end: () => void;
  withOverlayHidden: <T>(operation: () => Promise<T>) => Promise<T>;
}

export function createPickerSession(options: PickerSessionOptions): PickerSession {
  const picks = createPickState<PickerPick>();
  let armed = false;
  let setID: string | null = null;
  let nextIndex = 0;
  let modifier: string = modifierLabel(navigator.platform, navigator.userAgent);
  let hovered: Element | null = null;
  let host: HTMLDivElement | null = null;
  let boxes: HTMLDivElement | null = null;
  let hoverBox: HTMLDivElement | null = null;
  let hoverLabel: HTMLDivElement | null = null;
  let pill: HTMLDivElement | null = null;
  let clearButton: HTMLButtonElement | null = null;
  let previousCursor = '';
  let stopRouteWatch: (() => void) | null = null;

  const overlay = createOverlayHolds({
    hide: () => setOverlayHidden(true),
    show: () => setOverlayHidden(false),
  });

  function setOverlayHidden(hidden: boolean): void {
    const value = hidden ? 'hidden' : '';
    if (host !== null) host.style.visibility = value;
    if (pill !== null) pill.style.visibility = value;
  }

  function arm(): void {
    if (armed) return;
    armed = true;
    setID = crypto.randomUUID();
    nextIndex = 0;
    picks.clear();
    hovered = null;
    modifier = modifierLabel(navigator.platform, navigator.userAgent);
    previousCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';
    buildOverlay();
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange, true);
    window.addEventListener('blur', onWindowBlur);
    stopRouteWatch = watchWindowRoutes(onRouteChange);
    render();
  }

  function stopPicking(): void {
    if (!armed) return;
    armed = false;
    hovered = null;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange, true);
    window.removeEventListener('blur', onWindowBlur);
    document.documentElement.style.cursor = previousCursor;
    host?.remove();
    host = null;
    boxes = null;
    hoverBox = null;
    hoverLabel = null;
    pill = null;
    clearButton = null;
  }

  function stopWatching(): void {
    stopRouteWatch?.();
    stopRouteWatch = null;
  }

  function disarm(): void {
    if (!armed && setID === null) return;
    const cleared = setID;
    setID = null;
    picks.clear();
    stopPicking();
    stopWatching();
    options.onClear(cleared);
  }

  function end(): void {
    const cleared = setID;
    picks.clear();
    setID = null;
    stopPicking();
    stopWatching();
    if (cleared !== null) options.onClear(cleared);
  }

  function toggle(): boolean {
    if (armed) disarm();
    else arm();
    return armed;
  }

  function finish(): void {
    if (setID === null) return;
    const picked = picks.items();
    if (picked.length === 0) {
      disarm();
      return;
    }

    const anchor = picked[picked.length - 1]!.element;
    stopPicking();
    options.onFinish({ setID, picks: [...picked], anchor });
  }

  function clearPicks(): void {
    disarm();
  }

  function isModifier(event: MouseEvent): boolean {
    return event.metaKey || event.ctrlKey;
  }

  function isOverlayTarget(target: EventTarget | null): boolean {
    return target instanceof Node && host !== null && host.contains(target);
  }

  function add(element: Element): void {
    const id = setID ?? crypto.randomUUID();
    const index = nextIndex;
    nextIndex += 1;
    const feedback = assembleFeedback(readCapture(element), {
      id,
      capturedAt: new Date().toISOString(),
    });
    const pick: PickerPick = {
      feedback,
      element,
      index,
    };

    if (picks.add(pick) === null) {
      nextIndex = index;
      return;
    }

    options.onPick(feedback, index);
    render();
  }

  function onClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (isOverlayTarget(event.target)) return;
    if (!armed) return;

    event.preventDefault();
    event.stopPropagation();

    const element = event.target instanceof Element ? event.target : null;
    if (element === null) return;

    const existing = picks.items().find((pick) => pick.element === element);
    const action = pickAction({
      modifier: isModifier(event),
      selected: existing !== undefined,
      count: picks.count(),
    });

    switch (action) {
      case 'ignore':
        return;
      case 'remove':
        if (existing !== undefined) {
          picks.toggle(existing);
          render();
          if (setID !== null) options.onRemove(setID, existing.index);
        }
        return;
      case 'finish':
        finish();
        return;
      case 'add':
        add(element);
        return;
      case 'add-and-finish':
        add(element);
        finish();
        return;
    }
  }

  function onMouseMove(event: MouseEvent): void {
    if (!armed) return;
    if (isOverlayTarget(event.target)) {
      hovered = null;
      render();
      return;
    }
    hovered = event.target instanceof Element ? event.target : null;
    render();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!armed) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      clearPicks();
      return;
    }

    if (event.key === 'Enter' && picks.count() > 0) {
      event.preventDefault();
      event.stopPropagation();
      finish();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!armed) return;
    if (event.key !== 'Meta' && event.key !== 'Control') return;
    if (picks.count() > 0) finish();
    else disarm();
  }

  function onWindowBlur(): void {
    if (!armed) return;
    disarm();
  }

  function onRouteChange(): void {
    if (!armed && setID === null) return;

    const cleared = setID;
    setID = null;
    picks.clear();
    stopPicking();
    stopWatching();
    options.onRouteChange();
    options.onClear(cleared);
  }

  function onViewportChange(): void {
    render();
  }

  function buildOverlay(): void {
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
      clearPicks();
    });

    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = '* { cursor: crosshair !important; }';

    host.append(boxes, hoverBox, hoverLabel, pill, cursorStyle);
    document.documentElement.append(host);
    if (overlay.count() > 0) setOverlayHidden(true);
  }

  function render(): void {
    if (host === null) return;
    renderSelected();
    renderHover();
    renderPill();
  }

  function renderSelected(): void {
    if (boxes === null) return;
    boxes.textContent = '';

    picks.items().forEach((pick, position) => {
      const element = pick.element;
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

  function renderHover(): void {
    if (hoverBox === null || hoverLabel === null) return;

    const candidate = hovered;
    const selected = candidate !== null && picks.items().some((pick) => pick.element === candidate);
    if (candidate === null || !candidate.isConnected || selected) {
      hoverBox.style.display = 'none';
      hoverLabel.style.display = 'none';
      return;
    }

    const rect = candidate.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hoverBox.style.display = 'none';
      hoverLabel.style.display = 'none';
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

  function renderPill(): void {
    if (pill === null || clearButton === null) return;
    const count = picks.count();
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

  return { isArmed: () => armed, toggle, disarm, end, withOverlayHidden: overlay.guard };
}
