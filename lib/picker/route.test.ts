import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  PICKER_ROUTE_EVENT,
  installRouteEmitter,
  watchRouteChanges,
  type RouteListenerDeps,
} from './route';

interface FakeHistory {
  pushState: Mock<History['pushState']>;
  replaceState: Mock<History['replaceState']>;
}

interface FakeWindow {
  history: FakeHistory;
  emit: (type: string) => void;
  listeners: Map<string, () => void>;
  addEventListener: RouteListenerDeps['addEventListener'];
  removeEventListener: RouteListenerDeps['removeEventListener'];
}

function fakeHistory(): FakeHistory {
  return {
    pushState: vi.fn<History['pushState']>(),
    replaceState: vi.fn<History['replaceState']>(),
  };
}

function fakeWindow(): FakeWindow {
  const listeners = new Map<string, () => void>();

  return {
    history: fakeHistory(),
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

describe('page route emitter', () => {
  it('dispatches one route event after a page-world pushState', () => {
    const history = fakeHistory();
    const order: string[] = [];
    history.pushState.mockImplementation(() => {
      order.push('push');
    });

    installRouteEmitter({ history, dispatch: () => order.push('route') });

    history.pushState({}, '', '/next');

    expect(order).toEqual(['push', 'route']);
  });

  it('dispatches one route event after a page-world replaceState', () => {
    const history = fakeHistory();
    const order: string[] = [];
    history.replaceState.mockImplementation(() => {
      order.push('replace');
    });

    installRouteEmitter({ history, dispatch: () => order.push('route') });

    history.replaceState({}, '', '/next');

    expect(order).toEqual(['replace', 'route']);
  });

  it('passes the page arguments through to the original methods', () => {
    const history = fakeHistory();
    const original = history.pushState;
    installRouteEmitter({ history, dispatch: () => {} });

    history.pushState({ page: 1 }, '', '/next');

    expect(original).toHaveBeenCalledWith({ page: 1 }, '', '/next');
  });

  it('restores the page history methods and stops dispatching on stop', () => {
    const history = fakeHistory();
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const dispatch = vi.fn();

    const stop = installRouteEmitter({ history, dispatch });
    expect(history.pushState).not.toBe(originalPush);
    expect(history.replaceState).not.toBe(originalReplace);

    stop();

    expect(history.pushState).toBe(originalPush);
    expect(history.replaceState).toBe(originalReplace);

    history.pushState({}, '', '/next');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('restores prototype methods without leaving an own property behind', () => {
    const prototype = fakeHistory();
    const history = Object.create(prototype) as FakeHistory;

    const stop = installRouteEmitter({ history, dispatch: () => {} });
    expect(Object.prototype.hasOwnProperty.call(history, 'pushState')).toBe(true);

    stop();

    expect(Object.prototype.hasOwnProperty.call(history, 'pushState')).toBe(false);
    expect(history.pushState).toBe(prototype.pushState);
  });

  it('is safe to stop twice', () => {
    const history = fakeHistory();
    const stop = installRouteEmitter({ history, dispatch: () => {} });

    stop();
    expect(() => stop()).not.toThrow();
  });
});

describe('isolated route watch', () => {
  it('signals a page-world route event', () => {
    const win = fakeWindow();
    const changes = vi.fn();

    const stop = watchRouteChanges(win, changes);
    win.emit(PICKER_ROUTE_EVENT);

    expect(changes).toHaveBeenCalledTimes(1);
    expect(PICKER_ROUTE_EVENT).toBe('browsertalk:picker-route');
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

  it('drops every listener on stop', () => {
    const win = fakeWindow();
    const changes = vi.fn();

    const stop = watchRouteChanges(win, changes);
    expect(win.listeners.has(PICKER_ROUTE_EVENT)).toBe(true);
    expect(win.listeners.has('popstate')).toBe(true);
    expect(win.listeners.has('hashchange')).toBe(true);

    stop();

    expect(win.listeners.size).toBe(0);
    win.emit('popstate');
    expect(changes).not.toHaveBeenCalled();
  });
});
