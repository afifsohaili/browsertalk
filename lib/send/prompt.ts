import type { PickerAriaFacts } from '@/lib/picker/facts';
import type { OutboxItem } from '@/lib/storage/outbox';

export interface RenderPromptInput {
  projectName: string;
  item: OutboxItem;
  sentAt: string;
}

export function renderPrompt(input: RenderPromptInput): string {
  const { item } = input;
  const lines: string[] = [`## Browser feedback — ${input.projectName}`, ''];

  lines.push(`Comment:${item.comment.length > 0 ? ` ${item.comment}` : ''}`, '');

  if (item.facts.element !== undefined) {
    lines.push(...elementBlock(item));
    lines.push('');
  }

  lines.push(`Page: ${item.facts.page.url}`);
  if (item.facts.page.title.length > 0) {
    lines.push(`  title     ${item.facts.page.title}`);
  }
  lines.push('', `Sent by Browsertalk · ${input.sentAt}`);

  return lines.join('\n');
}

function elementBlock(item: OutboxItem): string[] {
  const element = item.facts.element;
  if (element === undefined) return [];

  const classes = element.classes.map((className) => `.${className}`).join('');
  const lines = [
    `Element: ${element.tag}${classes} — "${element.text}"`,
    `  selector  ${element.selector}`,
    `  box       ${element.box.width}×${element.box.height} @ (${element.box.x},${element.box.y}) · viewport ${element.viewport.width}×${element.viewport.height} · scroll (${element.scroll.x},${element.scroll.y})`,
  ];

  const attrs = Object.entries(element.attributes).map(([name, value]) => `${name}=${value}`);
  if (attrs.length > 0) lines.push(`  attrs     ${attrs.join(' · ')}`);

  const extras = item.facts.extras;
  if (extras?.component !== undefined) {
    lines.push(`  component ${extras.component}`);
  }

  const styles = Object.entries(extras?.styles ?? {}).map(([name, value]) => `${name}: ${value}`);
  if (styles.length > 0) lines.push(`  styles    ${styles.join(' · ')}`);

  const aria = ariaParts(extras?.aria);
  if (aria.length > 0) lines.push(`  aria      ${aria.join(' · ')}`);

  return lines;
}

function ariaParts(aria: PickerAriaFacts | undefined): string[] {
  if (aria === undefined) return [];
  const parts: string[] = [];
  if (aria.role !== undefined) parts.push(`role=${aria.role}`);
  if (aria.name !== undefined) parts.push(`name=${aria.name}`);
  return parts;
}
