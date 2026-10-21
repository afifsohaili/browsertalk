import { describe, expect, it, vi, type Mock } from 'vitest';
import { watchRouteChanges, type RouteWatcherDeps } from './route';

interface FakeHistory {
  pushState: Mock<History['pushState']>;
  replaceState: Mock<History['replaceState']>;
}

interface FakeWindow {
  history: FakeHistory;
  emit: (type: 'popstate' | 'hashchange') => void;
  listeners: Map<string, () => void>;
  addEventListener: RouteWatcherDeps['addEventListener'];
  removeEventListener: RouteWatcherDeps['removeEventListener'];
}

function fakeWindow(): FakeWindow {
  const listeners = new Map<string, () => void>();
  const history: FakeHistory = {
    pushState: vi.fn<History['pushState']>(),
    replaceState: vi.fn<History['replaceState']>(),
  };

  return {
    history,
    listeners,
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    emit: (type) => listeners.get(type)?.(),
  };
}

describe('route watch', () => {
  it('signals a route change after a patched pushState runs', () => {
    const win = fakeWindow();
    const events: string[] = [];
    win.history.pushState.mockImplementation(() => events.push('push'));

    const stop = watchRouteChanges(win, () => events.push('changed'));

    win.history.pushState({}, '', '/next');

    expect(events).toEqual(['push', 'changed']);
    stop();
  });

  it('signals a route change after a patched replaceState runs', () => {
    const win = fakeWindow();
    const events: string[] = [];
    win.history.replaceState.mockImplementation(() => events.push('replace'));

    const stop = watchRouteChanges(win, () => events.push('changed'));

    win.history.replaceState({}, '', '/next');

    expect(events).toEqual(['replace', 'changed']);
    stop();
  });

  it('signals back/forward and hash moves', () => {
    const win = fakeWindow();
    const changes = vi.fn();

    const stop = watchRouteChanges(win, changes);

    win.emit('popstate');
    win.emit('hashchange');

    expect(changes).toHaveBeenCalledTimes(2);
    stop();
  });

  it('restores the original history methods and drops listeners on stop', () => {
    const win = fakeWindow();
    const originalPush = win.history.pushState;
    const originalReplace = win.history.replaceState;

    const stop = watchRouteChanges(win, () => {});
    const patchedPush = win.history.pushState;
    const patchedReplace = win.history.replaceState;
    expect(patchedPush).not.toBe(originalPush);
    expect(patchedReplace).not.toBe(originalReplace);
    expect(win.listeners.has('popstate')).toBe(true);
    expect(win.listeners.has('hashchange')).toBe(true);

    stop();

    expect(win.history.pushState).toBe(originalPush);
    expect(win.history.replaceState).toBe(originalReplace);
    expect(win.listeners.has('popstate')).toBe(false);
    expect(win.listeners.has('hashchange')).toBe(false);
  });

  it('is safe to stop twice and to stop after the page already moved', () => {
    const win = fakeWindow();
    const changes = vi.fn();

    const stop = watchRouteChanges(win, changes);
    win.emit('popstate');
    stop();
    stop();

    win.emit('popstate');

    expect(changes).toHaveBeenCalledTimes(1);
  });
});
