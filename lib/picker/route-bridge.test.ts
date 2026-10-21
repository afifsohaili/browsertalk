// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PICKER_ROUTE_EVENT, installRouteEmitter, watchWindowRoutes } from './route';

const stops: Array<() => void> = [];

function bridge(changes: () => void): void {
  stops.push(
    installRouteEmitter({
      history: window.history,
      dispatch: () => window.dispatchEvent(new Event(PICKER_ROUTE_EVENT)),
    }),
    watchWindowRoutes(changes),
  );
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe('page-world to isolated route bridge', () => {
  it('carries a page-world pushState to the isolated watcher', () => {
    const changes = vi.fn();
    bridge(changes);

    window.history.pushState({ page: 1 }, '', '/next');

    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('carries a page-world replaceState to the isolated watcher', () => {
    const changes = vi.fn();
    bridge(changes);

    window.history.replaceState({}, '', '/next');

    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('stops both sides together', () => {
    const changes = vi.fn();
    bridge(changes);

    for (const stop of stops.splice(0)) stop();
    window.history.pushState({}, '', '/next');

    expect(changes).not.toHaveBeenCalled();
  });

  it('signals back and forward navigation', () => {
    const changes = vi.fn();
    stops.push(watchWindowRoutes(changes));

    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new Event('hashchange'));

    expect(changes).toHaveBeenCalledTimes(2);
  });
});
