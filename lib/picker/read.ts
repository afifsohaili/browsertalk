import type { ElementPathSegment, RawCapture, RawElementCapture } from './collect';
import { detectComponentName } from './component';
import { STYLE_PROPERTY_NAMES, type RawAriaCapture, type RawExtrasCapture } from './extras';

export function readCapture(element: Element): RawCapture {
  return {
    page: {
      url: window.location.href,
      title: document.title,
    },
    element: readElement(element),
    extras: readExtras(element),
  };
}

export function readExtras(element: Element): RawExtrasCapture {
  return {
    component: detectComponentName(element),
    styles: readStyles(element),
    aria: readAria(element),
  };
}

function readStyles(element: Element): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};
  for (const name of STYLE_PROPERTY_NAMES) {
    styles[name] = computed.getPropertyValue(name);
  }
  return styles;
}

function readAria(element: Element): RawAriaCapture {
  return {
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute('role'),
    inputType: element instanceof HTMLInputElement ? element.type : null,
    hasHref: element.hasAttribute('href'),
    multiple: element.hasAttribute('multiple'),
    ariaLabelledBy: readLabelledByText(element),
    ariaLabel: element.getAttribute('aria-label'),
    labelText: readLabelText(element),
    alt: element.getAttribute('alt'),
    title: element.getAttribute('title'),
    text: element.textContent ?? '',
  };
}

function readLabelledByText(element: Element): string | null {
  const ids = element.getAttribute('aria-labelledby');
  if (ids === null) return null;
  const text = ids
    .split(/\s+/)
    .filter((id) => id.length > 0)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();
  return text.length > 0 ? text : null;
}

function readLabelText(element: Element): string | null {
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLButtonElement
    )
  ) {
    return null;
  }
  const labels = element.labels;
  if (labels === null || labels.length === 0) return null;
  const text = Array.from(labels)
    .map((label) => label.textContent ?? '')
    .join(' ')
    .trim();
  return text.length > 0 ? text : null;
}

function readElement(element: Element): RawElementCapture {
  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id.length > 0 ? element.id : null,
    classes: Array.from(element.classList),
    chain: readChain(element),
    text: element.textContent ?? '',
    attributes: readAttributes(element),
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll: { x: window.scrollX, y: window.scrollY },
  };
}

function readAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const name of element.getAttributeNames()) {
    attributes[name.toLowerCase()] = element.getAttribute(name) ?? '';
  }
  return attributes;
}

function readChain(element: Element): ElementPathSegment[] {
  const chain: ElementPathSegment[] = [];
  const stop = document.body ?? document.documentElement;
  let current: Element | null = element;
  while (current !== null) {
    chain.push(segmentOf(current));
    if (current === stop) break;
    current = current.parentElement;
  }
  return chain.reverse();
}

function segmentOf(element: Element): ElementPathSegment {
  const parent = element.parentElement;
  const tag = element.tagName.toLowerCase();
  let index = 0;
  let siblingCount = 0;
  if (parent !== null) {
    for (const sibling of Array.from(parent.children)) {
      if (sibling.tagName.toLowerCase() === tag) {
        siblingCount += 1;
        if (sibling === element) index = siblingCount;
      }
    }
  }
  return {
    tag,
    id: element.id.length > 0 ? element.id : null,
    classes: Array.from(element.classList),
    index,
    siblingCount,
  };
}
