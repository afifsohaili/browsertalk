import { createComposerController, type ComposerQueueResult as ControllerQueueResult } from './controller';
import type { ComposerQueueResult } from './protocol';

export const COMPOSER_HOST_ID = 'browsertalk-composer';

const CONFIRMATION_MS = 900;
const HINT_TEXT = 'Enter queues · Esc dismisses';
const SCREENSHOT_DROPPED_NOTICE = 'Queued without the screenshot — storage is full';

export interface ComposerSessionOptions {
  queue: (comment: string) => Promise<ComposerQueueResult>;
}

export interface ComposerSession {
  openElement: (element: Element) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createComposerSession(options: ComposerSessionOptions): ComposerSession {
  let host: HTMLDivElement | null = null;
  let textarea: HTMLTextAreaElement | null = null;
  let queueButton: HTMLButtonElement | null = null;
  let errorLine: HTMLDivElement | null = null;
  let anchor: Element | null = null;
  let confirmationTimer: number | null = null;
  let notice: string | null = null;

  const controller = createComposerController({
    queue: async (comment): Promise<ControllerQueueResult> => {
      const result = await options.queue(comment);
      notice = result.ok && result.screenshotDropped === true ? SCREENSHOT_DROPPED_NOTICE : null;
      return result;
    },
    onTransition: render,
  });

  function open(element: Element): void {
    close();
    anchor = element;
    buildDom();
    controller.reset();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition, true);
    reposition();
    textarea?.focus();
  }

  function close(): void {
    if (confirmationTimer !== null) {
      window.clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition, true);
    host?.remove();
    host = null;
    textarea = null;
    queueButton = null;
    errorLine = null;
    anchor = null;
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

    if (event.key === 'Enter' && !event.shiftKey && event.target === textarea) {
      event.preventDefault();
      event.stopPropagation();
      void submit();
    }
  }

  async function submit(): Promise<void> {
    const queued = await controller.submit();
    if (!queued) return;
    showConfirmation();
  }

  function showConfirmation(): void {
    if (host === null) return;
    const current = host;
    current.textContent = notice ?? 'Queued';
    current.style.textAlign = 'center';
    current.style.fontWeight = '600';
    current.style.color = '#4f46e5';
    current.style.padding = '10px 8px';
    confirmationTimer = window.setTimeout(() => {
      confirmationTimer = null;
      if (host === current) close();
    }, CONFIRMATION_MS);
  }

  function reposition(): void {
    if (host === null) return;
    const rect = anchor?.getBoundingClientRect() ?? null;

    if (rect === null) {
      host.style.left = 'auto';
      host.style.top = 'auto';
      host.style.right = '16px';
      host.style.bottom = '16px';
      return;
    }

    const width = host.offsetWidth;
    const height = host.offsetHeight;
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);

    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function render(): void {
    if (host === null) return;
    const state = controller.getState();
    if (errorLine !== null) {
      errorLine.textContent = state.error ?? '';
      errorLine.style.display = state.error === null ? 'none' : 'block';
    }
    if (queueButton !== null) {
      queueButton.disabled = state.busy;
      queueButton.textContent = state.busy ? 'Queueing…' : 'Queue';
    }
  }

  function buildDom(): void {
    host = document.createElement('div');
    host.id = COMPOSER_HOST_ID;
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.boxSizing = 'border-box';
    host.style.width = '280px';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '6px';
    host.style.padding = '8px';
    host.style.border = '1px solid #4f46e5';
    host.style.borderRadius = '8px';
    host.style.background = '#ffffff';
    host.style.color = '#1c1c1e';
    host.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.18)';
    host.style.font = '12px/1.4 system-ui, -apple-system, sans-serif';

    textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.placeholder = 'What looks wrong?';
    textarea.style.boxSizing = 'border-box';
    textarea.style.width = '100%';
    textarea.style.resize = 'vertical';
    textarea.style.font = 'inherit';
    textarea.style.color = 'inherit';
    textarea.style.border = '1px solid #d1d1d6';
    textarea.style.borderRadius = '6px';
    textarea.style.padding = '6px';
    textarea.addEventListener('input', () => controller.setComment(textarea?.value ?? ''));

    errorLine = document.createElement('div');
    errorLine.style.display = 'none';
    errorLine.style.color = '#ff3b30';
    errorLine.style.fontSize = '11px';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '6px';

    const hint = document.createElement('span');
    hint.textContent = HINT_TEXT;
    hint.style.color = '#8e8e93';
    hint.style.fontSize = '11px';

    queueButton = document.createElement('button');
    queueButton.type = 'button';
    queueButton.textContent = 'Queue';
    queueButton.style.padding = '4px 10px';
    queueButton.style.border = '1px solid #4f46e5';
    queueButton.style.borderRadius = '6px';
    queueButton.style.background = '#4f46e5';
    queueButton.style.color = '#ffffff';
    queueButton.style.font = 'inherit';
    queueButton.style.cursor = 'pointer';
    queueButton.addEventListener('click', () => {
      void submit();
    });

    row.append(hint, queueButton);
    host.append(textarea, errorLine, row);
    document.documentElement.append(host);
  }

  return {
    openElement: (element) => open(element),
    close,
    isOpen: () => host !== null,
  };
}
