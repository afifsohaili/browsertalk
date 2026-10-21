import { createComposerController, type ComposerQueueResult as ControllerQueueResult } from './controller';
import {
  createComposerDom,
  renderComposerChips,
  renderComposerStatus,
  repositionComposer,
  showComposerConfirmation,
  type ComposerDomHandles,
} from './dom';
import type { ComposerQueueResult, ComposerRemoveResult } from './protocol';

const CONFIRMATION_MS = 900;
const SCREENSHOT_DROPPED_NOTICE = 'Queued without the screenshot — storage is full';

export interface ComposerSetElement {
  element: Element;
  label: string;
  index: number;
}

export interface ComposerSessionOptions {
  queue: (comment: string, elementCount: number) => Promise<ComposerQueueResult>;
  remove: (index: number) => Promise<ComposerRemoveResult>;
  onClose?: () => void;
}

export interface ComposerSetInput {
  elements: ComposerSetElement[];
  anchor: Element;
}

export interface ComposerSession {
  openSet: (input: ComposerSetInput) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createComposerSession(options: ComposerSessionOptions): ComposerSession {
  let dom: ComposerDomHandles | null = null;
  let entries: ComposerSetElement[] = [];
  let anchor: Element | null = null;
  let confirmationTimer: number | null = null;
  let notice: string | null = null;

  const controller = createComposerController({
    queue: async (comment): Promise<ControllerQueueResult> => {
      const result = await options.queue(comment, entries.length);
      notice = result.ok && result.screenshotDropped === true ? SCREENSHOT_DROPPED_NOTICE : null;
      return result;
    },
    onTransition: render,
  });

  function open(elements: ComposerSetElement[], element: Element): void {
    close();
    entries = [...elements];
    anchor = element;
    dom = createComposerDom({
      onInput: (value) => controller.setComment(value),
      onSubmit: () => {
        void submit();
      },
      onRemove: (index) => {
        void dropElement(index);
      },
    });
    controller.reset();
    renderChips();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition, true);
    reposition();
    dom.textarea.focus();
  }

  function close(): void {
    if (dom === null) return;
    if (confirmationTimer !== null) {
      window.clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition, true);
    dom.host.remove();
    dom = null;
    entries = [];
    anchor = null;
    options.onClose?.();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      controller.reset();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && event.target === dom?.textarea) {
      event.preventDefault();
      event.stopPropagation();
      void submit();
    }
  }

  async function submit(): Promise<void> {
    if (entries.length === 0) return;
    const queued = await controller.submit();
    if (!queued) return;
    showConfirmation();
  }

  async function dropElement(pickIndex: number): Promise<void> {
    const entry = entries.find((candidate) => candidate.index === pickIndex);
    if (entry === undefined) return;

    const outcome = await options.remove(pickIndex);
    if (!outcome.ok) {
      if (dom !== null) {
        dom.errorLine.textContent = outcome.error;
        dom.errorLine.style.display = 'block';
      }
      return;
    }

    entries = entries.filter((candidate) => candidate.index !== pickIndex);
    renderChips();
    dom?.textarea.focus();
  }

  function showConfirmation(): void {
    if (dom === null) return;
    const current = dom;
    showComposerConfirmation(current, notice ?? 'Queued');
    confirmationTimer = window.setTimeout(() => {
      confirmationTimer = null;
      if (dom === current) close();
    }, CONFIRMATION_MS);
  }

  function reposition(): void {
    if (dom !== null) repositionComposer(dom, anchor);
  }

  function render(): void {
    if (dom === null) return;
    const state = controller.getState();
    renderComposerStatus(dom, { error: state.error, busy: state.busy, entryCount: entries.length });
  }

  function renderChips(): void {
    if (dom === null) return;
    renderComposerChips(dom, entries, (index) => {
      void dropElement(index);
    });
    render();
  }

  return {
    openSet: ({ elements, anchor: element }) => open(elements, element),
    close,
    isOpen: () => dom !== null,
  };
}
