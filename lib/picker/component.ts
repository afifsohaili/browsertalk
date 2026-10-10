import { isRecord } from './facts';

export const MAX_COMPONENT_DEPTH = 50;

const REACT_FIBER_PREFIX = '__reactFiber$';
const VUE_COMPONENT_KEY = '__vueParentComponent';

export function detectComponentName(target: object): string | null {
  const record = target as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!key.startsWith(REACT_FIBER_PREFIX)) continue;
    const name = componentNameFromFiber(record[key]);
    if (name !== null) return name;
  }
  return componentNameFromVue(record[VUE_COMPONENT_KEY]);
}

export function componentNameFromFiber(fiber: unknown): string | null {
  let current: unknown = fiber;
  for (let depth = 0; depth < MAX_COMPONENT_DEPTH; depth += 1) {
    if (!isRecord(current)) return null;
    const name = fiberTypeName(current.type) ?? fiberTypeName(current.elementType);
    if (name !== null) return name;
    current = current.return;
  }
  return null;
}

export function componentNameFromVue(instance: unknown): string | null {
  let current: unknown = instance;
  for (let depth = 0; depth < MAX_COMPONENT_DEPTH; depth += 1) {
    if (!isRecord(current)) return null;
    const name = vueTypeName(current.type);
    if (name !== null) return name;
    current = current.parent;
  }
  return null;
}

function fiberTypeName(type: unknown): string | null {
  const direct = functionName(type);
  if (direct !== null) return direct;
  if (!isRecord(type)) return null;
  const displayName = trimmedString(type.displayName);
  if (displayName !== null) return displayName;
  return functionName(type.type) ?? functionName(type.render);
}

function vueTypeName(type: unknown): string | null {
  const direct = functionName(type);
  if (direct !== null) return direct;
  if (!isRecord(type)) return null;
  return trimmedString(type.name) ?? trimmedString(type.__name);
}

function functionName(value: unknown): string | null {
  if (typeof value !== 'function') return null;
  return trimmedString(value.name);
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
