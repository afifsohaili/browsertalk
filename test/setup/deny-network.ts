const DENIED = 'Denied native fetch in tests';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function denyNativeFetch(input: RequestInfo | URL): never {
  throw new Error(`${DENIED} to ${requestUrl(input)}. Inject the response with setOpenCodeFetch() or pass fetchFn.`);
}

function installDenyNetworkGuard(): void {
  globalThis.fetch = denyNativeFetch;
  if (typeof window !== 'undefined') window.fetch = denyNativeFetch;
}

installDenyNetworkGuard();
