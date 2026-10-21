import type { PickerElementFacts } from '@/lib/picker/facts';
import { formatElementLabel, trimText } from '@/lib/picker/collect';

export const CHIP_TEXT_LENGTH = 40;

export function formatCountLabel(count: number): string {
  return `${count} element${count === 1 ? '' : 's'}`;
}

export function formatChipLabel(facts: PickerElementFacts): string {
  const name = formatElementLabel(facts.tag, facts.id, facts.classes);
  const text = trimText(facts.text, CHIP_TEXT_LENGTH);
  return text.length === 0 ? name : `${name} · "${text}"`;
}

export function removeChip<T>(entries: readonly T[], index: number): T[] {
  if (index < 0 || index >= entries.length) return [...entries];
  return [...entries.slice(0, index), ...entries.slice(index + 1)];
}
