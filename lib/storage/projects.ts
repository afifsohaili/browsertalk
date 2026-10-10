import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export type OriginBindings = Record<string, string>;

export async function getOriginBindings(connectionKey: string): Promise<OriginBindings> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
  const byConnection = stored[STORAGE_KEYS.projects.byOrigin];
  if (typeof byConnection !== 'object' || byConnection === null) return {};

  const bindings = (byConnection as Record<string, unknown>)[connectionKey];
  if (typeof bindings !== 'object' || bindings === null) return {};

  const entries = Object.entries(bindings).filter((entry): entry is [string, string] => {
    return typeof entry[1] === 'string';
  });
  return Object.fromEntries(entries);
}

export async function bindProject(
  connectionKey: string,
  origin: string,
  projectDirectory: string,
): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
  const byConnection = asRecord(stored[STORAGE_KEYS.projects.byOrigin]);
  const bindings = await getOriginBindings(connectionKey);
  await browser.storage.local.set({
    [STORAGE_KEYS.projects.byOrigin]: {
      ...byConnection,
      [connectionKey]: { ...bindings, [origin]: projectDirectory },
    },
  });
}

export async function getBoundProject(connectionKey: string, origin: string): Promise<string | null> {
  const bindings = await getOriginBindings(connectionKey);
  return bindings[origin] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
