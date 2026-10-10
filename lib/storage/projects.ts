import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from './keys';

export type OriginBindings = Record<string, string>;

export async function getOriginBindings(): Promise<OriginBindings> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.projects.byOrigin);
  const bindings = stored[STORAGE_KEYS.projects.byOrigin];
  if (typeof bindings !== 'object' || bindings === null) return {};

  const entries = Object.entries(bindings).filter((entry): entry is [string, string] => {
    return typeof entry[1] === 'string';
  });
  return Object.fromEntries(entries);
}

export async function bindProject(origin: string, projectDirectory: string): Promise<void> {
  const bindings = await getOriginBindings();
  await browser.storage.local.set({
    [STORAGE_KEYS.projects.byOrigin]: { ...bindings, [origin]: projectDirectory },
  });
}

export async function getBoundProject(origin: string): Promise<string | null> {
  const bindings = await getOriginBindings();
  return bindings[origin] ?? null;
}
