export const PICKER_ROUTE_EVENT = 'browsertalk:picker-route';

export interface RouteEmitterDeps {
  history: Pick<History, 'pushState' | 'replaceState'>;
  dispatch: () => void;
}

export interface RouteListenerDeps {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function installRouteEmitter(deps: RouteEmitterDeps): () => void {
  const { history, dispatch } = deps;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const ownedPush = Object.prototype.hasOwnProperty.call(history, 'pushState');
  const ownedReplace = Object.prototype.hasOwnProperty.call(history, 'replaceState');
  let stopped = false;

  history.pushState = function patchedPush(
    this: History,
    ...args: Parameters<History['pushState']>
  ): ReturnType<History['pushState']> {
    const result = originalPush.apply(this, args);
    dispatch();
    return result;
  };
  history.replaceState = function patchedReplace(
    this: History,
    ...args: Parameters<History['replaceState']>
  ): ReturnType<History['replaceState']> {
    const result = originalReplace.apply(this, args);
    dispatch();
    return result;
  };

  return () => {
    if (stopped) return;
    stopped = true;

    if (ownedPush) history.pushState = originalPush;
    else delete (history as { pushState?: unknown }).pushState;
    if (ownedReplace) history.replaceState = originalReplace;
    else delete (history as { replaceState?: unknown }).replaceState;
  };
}

export function watchRouteChanges(deps: RouteListenerDeps, onChange: () => void): () => void {
  let stopped = false;

  deps.addEventListener(PICKER_ROUTE_EVENT, onChange);
  deps.addEventListener('popstate', onChange);
  deps.addEventListener('hashchange', onChange);

  return () => {
    if (stopped) return;
    stopped = true;

    deps.removeEventListener(PICKER_ROUTE_EVENT, onChange);
    deps.removeEventListener('popstate', onChange);
    deps.removeEventListener('hashchange', onChange);
  };
}

export function watchWindowRoutes(onChange: () => void): () => void {
  return watchRouteChanges(
    {
      addEventListener: (type, listener) => window.addEventListener(type, listener),
      removeEventListener: (type, listener) => window.removeEventListener(type, listener),
    },
    onChange,
  );
}
