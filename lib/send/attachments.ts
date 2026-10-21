import type { FeedbackAttachment } from '@/lib/agent-backend/interface';
import type { PickerElementCapture } from '@/lib/picker/facts';
import { MAX_ELEMENT_ATTACHMENTS } from '@/lib/picker/limits';

export function elementAttachments(elements: readonly PickerElementCapture[] | undefined): FeedbackAttachment[] {
  if (elements === undefined) return [];
  return elements
    .flatMap((entry, index) => {
      if (entry.extras?.screenshot === undefined) return [];
      return [
        {
          uri: entry.extras.screenshot.dataUrl,
          name: `element-${index + 1}.png`,
          description: `Screenshot of element ${index + 1}`,
        },
      ];
    })
    .slice(0, MAX_ELEMENT_ATTACHMENTS);
}
