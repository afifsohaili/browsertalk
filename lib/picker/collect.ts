import {
  KEY_ATTRIBUTE_NAMES,
  MAX_LABEL_CLASSES,
  MAX_TEXT_LENGTH,
  type PickerBoxFacts,
  type PickerElementFacts,
  type PickerFeedback,
  type PickerPageFacts,
  type PickerPointFacts,
  type PickerSizeFacts,
} from './facts';
import { assembleExtras, type RawExtrasCapture } from './extras';

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SizeLike {
  width: number;
  height: number;
}

export interface PointLike {
  x: number;
  y: number;
}

export interface ElementPathSegment {
  tag: string;
  id: string | null;
  classes: string[];
  index: number;
  siblingCount: number;
}

export interface RawPageCapture {
  url: string;
  title: string;
}

export interface RawElementCapture {
  tag: string;
  id: string | null;
  classes: string[];
  chain: ElementPathSegment[];
  text: string;
  attributes: Record<string, string>;
  box: RectLike;
  viewport: SizeLike;
  scroll: PointLike;
}

export interface RawCapture {
  page: RawPageCapture;
  element: RawElementCapture;
  extras?: RawExtrasCapture;
}

export interface CaptureMeta {
  id: string;
  capturedAt: string;
}

const SAFE_CLASS = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function buildSelectorPath(chain: ElementPathSegment[]): string {
  if (chain.length === 0) return '';

  let start = 0;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const segment = chain[i];
    if (segment !== undefined && segment.id !== null) {
      start = i;
      break;
    }
  }

  return chain.slice(start).map(segmentToPart).join(' > ');
}

function segmentToPart(segment: ElementPathSegment): string {
  const tag = segment.tag.toLowerCase();
  if (segment.id !== null) return `${tag}#${segment.id}`;
  let part = tag;
  for (const className of segment.classes) {
    if (SAFE_CLASS.test(className)) part += `.${className}`;
  }
  if (segment.siblingCount > 1) part += `:nth-of-type(${segment.index})`;
  return part;
}

export function trimText(text: string, maxLength = MAX_TEXT_LENGTH): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength)}…`;
}

export function pickAttributes(attributes: Record<string, string>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of KEY_ATTRIBUTE_NAMES) {
    const value = attributes[name];
    if (typeof value === 'string' && value.length > 0) picked[name] = value;
  }
  return picked;
}

export function formatElementLabel(tag: string, id: string | null, classes: string[]): string {
  let label = tag.toLowerCase();
  if (id !== null && id.length > 0) label += `#${id}`;
  for (const className of classes.slice(0, MAX_LABEL_CLASSES)) label += `.${className}`;
  return label;
}

export function parsePageFacts(url: string, title: string): PickerPageFacts {
  const trimmedTitle = title.trim();
  try {
    const parsed = new URL(url);
    return {
      url,
      path: parsed.pathname,
      query: [...parsed.searchParams.entries()].map(([name, value]) => ({ name, value })),
      title: trimmedTitle,
    };
  } catch {
    return { url, path: '', query: [], title: trimmedTitle };
  }
}

export function toBoxFacts(rect: RectLike): PickerBoxFacts {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function toSizeFacts(size: SizeLike): PickerSizeFacts {
  return { width: Math.round(size.width), height: Math.round(size.height) };
}

export function toPointFacts(point: PointLike): PickerPointFacts {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function assembleFeedback(raw: RawCapture, meta: CaptureMeta): PickerFeedback {
  const element: PickerElementFacts = {
    tag: raw.element.tag.toLowerCase(),
    id: raw.element.id,
    classes: raw.element.classes,
    selector: buildSelectorPath(raw.element.chain),
    text: trimText(raw.element.text),
    attributes: pickAttributes(raw.element.attributes),
    box: toBoxFacts(raw.element.box),
    viewport: toSizeFacts(raw.element.viewport),
    scroll: toPointFacts(raw.element.scroll),
  };

  const extras = assembleExtras(raw.extras);

  return {
    id: meta.id,
    capturedAt: meta.capturedAt,
    page: parsePageFacts(raw.page.url, raw.page.title),
    elements: [{ element, ...(extras === null ? {} : { extras }) }],
  };
}
