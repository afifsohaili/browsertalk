// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPickerSession, type PickerSessionOptions } from './session';

interface SessionSpies {
  options: PickerSessionOptions;
  onPick: ReturnType<typeof vi.fn<PickerSessionOptions['onPick']>>;
  onFinish: ReturnType<typeof vi.fn<PickerSessionOptions['onFinish']>>;
  onRemove: ReturnType<typeof vi.fn<PickerSessionOptions['onRemove']>>;
  onClear: ReturnType<typeof vi.fn<PickerSessionOptions['onClear']>>;
  onRouteChange: ReturnType<typeof vi.fn<PickerSessionOptions['onRouteChange']>>;
}

function spies(): SessionSpies {
  const onPick = vi.fn<PickerSessionOptions['onPick']>();
  const onFinish = vi.fn<PickerSessionOptions['onFinish']>();
  const onRemove = vi.fn<PickerSessionOptions['onRemove']>();
  const onClear = vi.fn<PickerSessionOptions['onClear']>();
  const onRouteChange = vi.fn<PickerSessionOptions['onRouteChange']>();

  return {
    onPick,
    onFinish,
    onRemove,
    onClear,
    onRouteChange,
    options: { onPick, onFinish, onRemove, onClear, onRouteChange },
  };
}

describe('picker session lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.cursor = '';
  });

  it('clears the background pending when the composer ends the set', () => {
    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(typeof session.onClear.mock.calls[0]?.[0]).toBe('string');

    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
  });

  it('names the finished set when the composer closes it', () => {
    const button = document.createElement('button');
    button.id = 'checkout';
    button.textContent = 'Checkout';
    document.body.append(button);

    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));

    expect(session.onFinish).toHaveBeenCalledTimes(1);
    const finished = session.onFinish.mock.calls[0]?.[0];
    expect(finished?.picks).toHaveLength(1);

    picker.end();

    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(session.onClear).toHaveBeenCalledWith(finished?.setID);
  });

  it('clears once and closes the composer on a route change', () => {
    const session = spies();
    const picker = createPickerSession(session.options);

    picker.toggle();
    window.dispatchEvent(new Event('popstate'));

    expect(session.onRouteChange).toHaveBeenCalledTimes(1);
    expect(session.onClear).toHaveBeenCalledTimes(1);
    expect(typeof session.onClear.mock.calls[0]?.[0]).toBe('string');
  });
});
