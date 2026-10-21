export interface RouteWatcherDeps {
  history: Pick<History, 'pushState' | 'replaceState'>;
  addEventListener: (type: 'popstate' | 'hashchange', listener: () => void) => void;
  removeEventListener: (type: 'popstate' | 'hashchange', listener: () => void) => void;
}

export function watchRouteChanges(deps: RouteWatcherDeps, onChange: () => void): () => void {
  const { history } = deps;
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
    onChange();
    return result;
  };
  history.replaceState = function patchedReplace(
    this: History,
    ...args: Parameters<History['replaceState']>
  ): ReturnType<History['replaceState']> {
    const result = originalReplace.apply(this, args);
    onChange();
    return result;
  };

  deps.addEventListener('popstate', onChange);
  deps.addEventListener('hashchange', onChange);

  return () => {
    if (stopped) return;
    stopped = true;

    if (ownedPush) history.pushState = originalPush;
    else delete (history as { pushState?: unknown }).pushState;
    if (ownedReplace) history.replaceState = originalReplace;
    else delete (history as { replaceState?: unknown }).replaceState;

    deps.removeEventListener('popstate', onChange);
    deps.removeEventListener('hashchange', onChange);
  };
}

export function watchWindowRoutes(onChange: () => void): () => void {
  return watchRouteChanges(
    {
      history: window.history,
      addEventListener: (type, listener) => window.addEventListener(type, listener),
      removeEventListener: (type, listener) => window.removeEventListener(type, listener),
    },
    onChange,
  );
}
