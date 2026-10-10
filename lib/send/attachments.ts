import type { FeedbackAttachment } from '@/lib/agent-backend/interface';
import type { PickerExtras } from '@/lib/picker/facts';

export function elementAttachment(extras: PickerExtras | undefined): FeedbackAttachment | null {
  if (extras?.screenshot === undefined) return null;
  return {
    uri: extras.screenshot.dataUrl,
    name: 'element.png',
    description: 'Screenshot of the picked element',
  };
}
