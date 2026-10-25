// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArmPickerButton from '@/components/ArmPickerButton.vue';

const requestArmPicker = vi.hoisted(() => vi.fn());

vi.mock('@/lib/picker/messages', () => ({ requestArmPicker }));

describe('arm picker button', () => {
  beforeEach(() => {
    requestArmPicker.mockReset();
    requestArmPicker.mockResolvedValue({ ok: true, armed: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stays disabled and explains why when the target is not ready', async () => {
    const view = mount(ArmPickerButton, {
      props: { disabled: true, disabledReason: 'Choose a project first' },
    });

    const button = view.get('button');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('title')).toBe('Choose a project first');
    expect(view.text()).toContain('Choose a project first');

    await button.trigger('click');
    expect(requestArmPicker).not.toHaveBeenCalled();
  });

  it('arms the picker when enabled', async () => {
    const view = mount(ArmPickerButton);

    expect(view.get('button').attributes('disabled')).toBeUndefined();
    await view.get('button').trigger('click');

    expect(requestArmPicker).toHaveBeenCalledTimes(1);
    expect(view.text()).toContain('Picker armed');
  });

  it('shows the background error instead of the arm note', async () => {
    requestArmPicker.mockResolvedValue({ ok: false, error: 'No active page to arm the picker on' });
    const view = mount(ArmPickerButton);

    await view.get('button').trigger('click');

    expect(view.text()).toContain('No active page to arm the picker on');
    expect(view.text()).not.toContain('Picker armed');
  });
});
