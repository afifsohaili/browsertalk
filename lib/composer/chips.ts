import type { PickerElementFacts } from '@/lib/picker/facts';
import { formatElementLabel, trimText } from '@/lib/picker/collect';

export const CHIP_TEXT_LENGTH = 40;

export function formatChipLabel(facts: PickerElementFacts): string {
  const name = formatElementLabel(facts.tag, facts.id, facts.classes);
  const text = trimText(facts.text, CHIP_TEXT_LENGTH);
  return text.length === 0 ? name : `${name} · "${text}"`;
}
