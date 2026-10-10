export const KEY_ATTRIBUTE_NAMES = [
  'href',
  'src',
  'role',
  'aria-label',
  'data-testid',
  'placeholder',
] as const;

export type KeyAttributeName = (typeof KEY_ATTRIBUTE_NAMES)[number];

export const MAX_TEXT_LENGTH = 160;
export const MAX_LABEL_CLASSES = 3;

export interface PickerQueryParam {
  name: string;
  value: string;
}

export interface PickerPageFacts {
  url: string;
  path: string;
  query: PickerQueryParam[];
  title: string;
}

export interface PickerBoxFacts {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PickerSizeFacts {
  width: number;
  height: number;
}

export interface PickerPointFacts {
  x: number;
  y: number;
}

export interface PickerElementFacts {
  tag: string;
  id: string | null;
  classes: string[];
  selector: string;
  text: string;
  attributes: Record<string, string>;
  box: PickerBoxFacts;
  viewport: PickerSizeFacts;
  scroll: PickerPointFacts;
}

export interface PickerFeedback {
  id: string;
  capturedAt: string;
  page: PickerPageFacts;
  element: PickerElementFacts;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isQueryParams(value: unknown): value is PickerQueryParam[] {
  return Array.isArray(value) && value.every((param) => isRecord(param) && isString(param.name) && isString(param.value));
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

function isBox(value: unknown): value is PickerBoxFacts {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
}

function isSize(value: unknown): value is PickerSizeFacts {
  return isRecord(value) && isFiniteNumber(value.width) && isFiniteNumber(value.height);
}

function isPoint(value: unknown): value is PickerPointFacts {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isPageFacts(value: unknown): value is PickerPageFacts {
  return (
    isRecord(value) &&
    isString(value.url) &&
    isString(value.path) &&
    isString(value.title) &&
    isQueryParams(value.query)
  );
}

function isElementFacts(value: unknown): value is PickerElementFacts {
  return (
    isRecord(value) &&
    isString(value.tag) &&
    (value.id === null || isString(value.id)) &&
    isStringArray(value.classes) &&
    isString(value.selector) &&
    isString(value.text) &&
    isStringRecord(value.attributes) &&
    isBox(value.box) &&
    isSize(value.viewport) &&
    isPoint(value.scroll)
  );
}

export function isPickerFeedback(value: unknown): value is PickerFeedback {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.capturedAt) &&
    isPageFacts(value.page) &&
    isElementFacts(value.element)
  );
}
