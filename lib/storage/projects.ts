import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';
import { enqueueStorageWrite } from './writer';

export type OriginBindings = Record<string, string>;

export async function getOriginBindings(connectionKey: string): Promise<OriginBindings> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
  const byConnection = stored[STORAGE_KEYS.projects.byOrigin];
  if (typeof byConnection !== 'object' || byConnection === null) return {};
  return stringBindings((byConnection as Record<string, unknown>)[connectionKey]);
}

export function bindProject(connectionKey: string, origin: string, projectDirectory: string): Promise<void> {
  return enqueueStorageWrite(async () => {
    const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
    const byConnection = asRecord(stored[STORAGE_KEYS.projects.byOrigin]);
    const bindings = stringBindings(byConnection[connectionKey]);
    await browser.storage.local.set({
      [STORAGE_KEYS.projects.byOrigin]: {
        ...byConnection,
        [connectionKey]: { ...bindings, [origin]: projectDirectory },
      },
    });
  });
}

export async function getBoundProject(connectionKey: string, origin: string): Promise<string | null> {
  const bindings = await getOriginBindings(connectionKey);
  return bindings[origin] ?? null;
}

function stringBindings(value: unknown): OriginBindings {
  if (typeof value !== 'object' || value === null) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[1] === 'string';
  });
  return Object.fromEntries(entries);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
