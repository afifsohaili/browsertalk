import { isImageDataUrl } from './limits';

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

export interface PickerElementCapture {
  element: PickerElementFacts;
  index?: number;
  extras?: PickerExtras;
}

export interface PickerFeedback {
  id: string;
  capturedAt: string;
  page: PickerPageFacts;
  elements: PickerElementCapture[];
}

export interface PickerScreenshotFacts {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PickerAriaFacts {
  role?: string;
  name?: string;
}

export interface PickerExtras {
  screenshot?: PickerScreenshotFacts;
  component?: string;
  styles?: Record<string, string>;
  aria?: PickerAriaFacts;
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

export function isPageFacts(value: unknown): value is PickerPageFacts {
  return (
    isRecord(value) &&
    isString(value.url) &&
    isString(value.path) &&
    isString(value.title) &&
    isQueryParams(value.query)
  );
}

export function isElementFacts(value: unknown): value is PickerElementFacts {
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

function isScreenshotFacts(value: unknown): value is PickerScreenshotFacts {
  return (
    isRecord(value) &&
    isImageDataUrl(value.dataUrl) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
}

function isAriaFacts(value: unknown): value is PickerAriaFacts {
  if (!isRecord(value)) return false;
  if (value.role !== undefined && !isString(value.role)) return false;
  if (value.name !== undefined && !isString(value.name)) return false;
  return value.role !== undefined || value.name !== undefined;
}

export function isPickerExtras(value: unknown): value is PickerExtras {
  if (!isRecord(value)) return false;
  if (value.screenshot !== undefined && !isScreenshotFacts(value.screenshot)) return false;
  if (value.component !== undefined && !isString(value.component)) return false;
  if (value.styles !== undefined && !isStringRecord(value.styles)) return false;
  if (value.aria !== undefined && !isAriaFacts(value.aria)) return false;
  return true;
}

export function isPickerElementCapture(value: unknown): value is PickerElementCapture {
  if (!isRecord(value)) return false;
  if (!isElementFacts(value.element)) return false;
  if (value.index !== undefined && !isPickIndex(value.index)) return false;
  if (value.extras !== undefined && !isPickerExtras(value.extras)) return false;
  return true;
}

function isPickIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isPickerFeedback(value: unknown): value is PickerFeedback {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.capturedAt) &&
    isPageFacts(value.page) &&
    Array.isArray(value.elements) &&
    value.elements.length > 0 &&
    value.elements.every(isPickerElementCapture)
  );
}
