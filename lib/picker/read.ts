import type { ElementPathSegment, RawCapture, RawElementCapture } from './collect';

export function readCapture(element: Element): RawCapture {
  return {
    page: {
      url: window.location.href,
      title: document.title,
    },
    element: readElement(element),
  };
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
