import type { PickerAriaFacts, PickerElementCapture, PickerElementFacts, PickerExtras } from '@/lib/picker/facts';
import type { OutboxItem } from '@/lib/storage/outbox';

export interface RenderPromptInput {
  projectName: string;
  item: OutboxItem;
}

export function renderPrompt(input: RenderPromptInput): string {
  const { item } = input;
  const lines: string[] = [`## Browser feedback — ${input.projectName}`, ''];

  lines.push(`Comment:${item.comment.length > 0 ? ` ${item.comment}` : ''}`, '');

  const elements = item.facts.elements;
  if (elements !== undefined && elements.length > 0) {
    lines.push(...elementLines(elements));
    lines.push('');
  }

  lines.push(`Page: ${item.facts.page.url}`);
  if (item.facts.page.title.length > 0) {
    lines.push(`  title     ${item.facts.page.title}`);
  }

  return lines.join('\n');
}

function elementLines(elements: readonly PickerElementCapture[]): string[] {
  const multiple = elements.length > 1;
  const lines: string[] = multiple ? [`Elements (${elements.length}):`] : [];

  elements.forEach((entry, index) => {
    const prefix = multiple ? `${index + 1}. ` : 'Element: ';
    lines.push(`${prefix}${elementLine(entry.element)}`);

    const extras = extrasLine(entry.extras, multiple ? '   ' : '  ');
    if (extras !== undefined) lines.push(extras);
  });

  return lines;
}

function elementLine(element: PickerElementFacts): string {
  const classes = element.classes.map((className) => `.${className}`).join('');
  const parts = [`${element.tag}${classes} — "${element.text}"`, element.selector];

  const attrs = Object.entries(element.attributes).map(([name, value]) => `${name}=${value}`);
  if (attrs.length > 0) parts.push(attrs.join(' · '));

  return parts.join(' · ');
}

function extrasLine(extras: PickerExtras | undefined, indent: string): string | undefined {
  if (extras === undefined) return undefined;

  const parts: string[] = [];
  if (extras.component !== undefined) parts.push(extras.component);

  const styles = Object.entries(extras.styles ?? {}).map(([name, value]) => `${name}: ${value}`);
  parts.push(...styles);

  parts.push(...ariaParts(extras.aria));

  if (parts.length === 0) return undefined;
  return `${indent}extras    ${parts.join(' · ')}`;
}

function ariaParts(aria: PickerAriaFacts | undefined): string[] {
  if (aria === undefined) return [];
  const parts: string[] = [];
  if (aria.role !== undefined) parts.push(`role=${aria.role}`);
  if (aria.name !== undefined) parts.push(`name=${aria.name}`);
  return parts;
}
