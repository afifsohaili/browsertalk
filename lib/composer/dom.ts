import { formatElementCount } from '@/lib/element-count';

export const COMPOSER_HOST_ID = 'browsertalk-composer';

const HINT_TEXT = 'Enter queues · Esc dismisses';
const EMPTY_SET_TEXT = 'No elements left. Close and pick again.';

export interface ComposerChip {
  label: string;
  index: number;
}

export interface ComposerDomHandles {
  host: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  queueButton: HTMLButtonElement;
  errorLine: HTMLDivElement;
  countLine: HTMLDivElement;
  chipsRow: HTMLDivElement;
  emptyLine: HTMLDivElement;
}

export interface ComposerDomCallbacks {
  onInput: (value: string) => void;
  onSubmit: () => void;
  onRemove: (index: number) => void;
}

export interface ComposerStatus {
  error: string | null;
  busy: boolean;
  entryCount: number;
}

export function createComposerDom(callbacks: ComposerDomCallbacks): ComposerDomHandles {
  const host = document.createElement('div');
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

  const countLine = document.createElement('div');
  countLine.style.fontSize = '11px';
  countLine.style.fontWeight = '600';
  countLine.style.color = '#4f46e5';

  const chipsRow = document.createElement('div');
  chipsRow.style.display = 'flex';
  chipsRow.style.flexWrap = 'wrap';
  chipsRow.style.gap = '4px';

  const emptyLine = document.createElement('div');
  emptyLine.textContent = EMPTY_SET_TEXT;
  emptyLine.style.padding = '10px';
  emptyLine.style.border = '1px dashed #d1d1d6';
  emptyLine.style.borderRadius = '8px';
  emptyLine.style.color = '#8e8e93';
  emptyLine.style.fontSize = '11px';
  emptyLine.style.textAlign = 'center';

  const textarea = document.createElement('textarea');
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
  textarea.addEventListener('input', () => callbacks.onInput(textarea.value));

  const errorLine = document.createElement('div');
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

  const queueButton = document.createElement('button');
  queueButton.type = 'button';
  queueButton.textContent = 'Queue';
  queueButton.disabled = true;
  queueButton.style.padding = '4px 10px';
  queueButton.style.border = '1px solid #4f46e5';
  queueButton.style.borderRadius = '6px';
  queueButton.style.background = '#4f46e5';
  queueButton.style.color = '#ffffff';
  queueButton.style.font = 'inherit';
  queueButton.style.cursor = 'pointer';
  queueButton.addEventListener('click', () => callbacks.onSubmit());

  row.append(hint, queueButton);
  host.append(countLine, chipsRow, emptyLine, textarea, errorLine, row);
  document.documentElement.append(host);

  return { host, textarea, queueButton, errorLine, countLine, chipsRow, emptyLine };
}

export function renderComposerChips(
  handles: ComposerDomHandles,
  entries: readonly ComposerChip[],
  onRemove: (index: number) => void,
): void {
  const empty = entries.length === 0;
  handles.chipsRow.textContent = '';
  handles.chipsRow.style.display = empty ? 'none' : 'flex';
  handles.emptyLine.style.display = empty ? 'block' : 'none';

  handles.countLine.textContent = empty ? '' : formatElementCount(entries.length);
  handles.countLine.style.display = empty ? 'none' : 'block';

  entries.forEach((entry) => {
    const chip = document.createElement('span');
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '3px';
    chip.style.maxWidth = '100%';
    chip.style.padding = '2px 4px 2px 6px';
    chip.style.borderRadius = '6px';
    chip.style.background = '#eef2ff';
    chip.style.color = '#4f46e5';
    chip.style.font = '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace';
    chip.style.whiteSpace = 'nowrap';

    const text = document.createElement('span');
    text.textContent = entry.label;
    text.title = entry.label;
    text.style.overflow = 'hidden';
    text.style.textOverflow = 'ellipsis';
    text.style.whiteSpace = 'nowrap';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${entry.label}`);
    remove.style.border = '0';
    remove.style.background = 'transparent';
    remove.style.color = 'inherit';
    remove.style.cursor = 'pointer';
    remove.style.font = 'inherit';
    remove.style.padding = '0 2px';
    remove.addEventListener('click', () => {
      onRemove(entry.index);
    });

    chip.append(text, remove);
    handles.chipsRow.append(chip);
  });
}

export function renderComposerStatus(handles: ComposerDomHandles, status: ComposerStatus): void {
  handles.errorLine.textContent = status.error ?? '';
  handles.errorLine.style.display = status.error === null ? 'none' : 'block';
  handles.queueButton.disabled = status.busy || status.entryCount === 0;
  handles.queueButton.textContent = status.busy ? 'Queueing…' : 'Queue';
}

export function showComposerConfirmation(handles: ComposerDomHandles, text: string): void {
  handles.host.textContent = text;
  handles.host.style.textAlign = 'center';
  handles.host.style.fontWeight = '600';
  handles.host.style.color = '#4f46e5';
  handles.host.style.padding = '10px 8px';
}

export function repositionComposer(handles: ComposerDomHandles, anchor: Element | null): void {
  const rect = anchor?.getBoundingClientRect() ?? null;
  const host = handles.host;

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
