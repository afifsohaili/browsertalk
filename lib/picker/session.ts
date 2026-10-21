import { assembleFeedback } from './collect';
import type { PickerFeedback } from './facts';
import { createPickerOverlay } from './overlay';
import { modifierLabel } from './platform';
import { readCapture } from './read';
import { watchWindowRoutes } from './route';
import { createPickState, pickAction } from './pick-state';

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
  const overlay = createPickerOverlay(clearPicks);

  let armed = false;
  let setID: string | null = null;
  let nextIndex = 0;
  let modifier: string = modifierLabel(navigator.platform, navigator.userAgent);
  let hovered: Element | null = null;
  let previousCursor = '';
  let stopRouteWatch: (() => void) | null = null;

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
    overlay.mount();
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
    overlay.unmount();
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
    if (overlay.contains(event.target)) return;
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
    if (overlay.contains(event.target)) {
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

  function render(): void {
    overlay.render({ picks: picks.items().map((pick) => pick.element), hovered, modifier });
  }

  return { isArmed: () => armed, toggle, disarm, end, withOverlayHidden: overlay.withHidden };
}
