import { describe, expect, it } from 'vitest';
import type { PickerElementCapture, PickerElementFacts } from '@/lib/picker/facts';
import { elementAttachments } from './attachments';

function element(selector: string): PickerElementFacts {
  return {
    tag: 'div',
    id: null,
    classes: [],
    selector,
    text: selector,
    attributes: {},
    box: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1280, height: 800 },
    scroll: { x: 0, y: 0 },
  };
}

function capture(selector: string, dataUrl?: string): PickerElementCapture {
  return {
    element: element(selector),
    ...(dataUrl === undefined
      ? {}
      : { extras: { screenshot: { dataUrl, width: 100, height: 20 } } }),
  };
}

describe('element attachments', () => {
  it('names a single screenshot element-1.png', () => {
    expect(elementAttachments([capture('a', 'data:image/png;base64,AAAA')])).toEqual([
      {
        uri: 'data:image/png;base64,AAAA',
        name: 'element-1.png',
        description: 'Screenshot of element 1',
      },
    ]);
  });

  it('keeps element order and names each shot by its element ordinal', () => {
    const attachments = elementAttachments([
      capture('a', 'data:image/png;base64,AAAA'),
      capture('b', 'data:image/png;base64,BBBB'),
      capture('c', 'data:image/png;base64,CCCC'),
    ]);

    expect(attachments.map((attachment) => attachment.name)).toEqual([
      'element-1.png',
      'element-2.png',
      'element-3.png',
    ]);
    expect(attachments.map((attachment) => attachment.uri)).toEqual([
      'data:image/png;base64,AAAA',
      'data:image/png;base64,BBBB',
      'data:image/png;base64,CCCC',
    ]);
  });

  it('skips elements without a screenshot but keeps the element ordinal', () => {
    const attachments = elementAttachments([
      capture('a'),
      capture('b', 'data:image/png;base64,BBBB'),
      capture('c'),
      capture('d', 'data:image/png;base64,DDDD'),
    ]);

    expect(attachments.map((attachment) => attachment.name)).toEqual(['element-2.png', 'element-4.png']);
  });

  it('returns nothing for a page-only item', () => {
    expect(elementAttachments(undefined)).toEqual([]);
    expect(elementAttachments([])).toEqual([]);
  });

  it('returns nothing when no element has a screenshot', () => {
    expect(elementAttachments([capture('a'), capture('b')])).toEqual([]);
  });

  it('caps a five-element set at four attachments', () => {
    const attachments = elementAttachments([
      capture('a', 'data:image/png;base64,AAAA'),
      capture('b', 'data:image/png;base64,BBBB'),
      capture('c', 'data:image/png;base64,CCCC'),
      capture('d', 'data:image/png;base64,DDDD'),
      capture('e', 'data:image/png;base64,EEEE'),
    ]);

    expect(attachments.map((attachment) => attachment.name)).toEqual([
      'element-1.png',
      'element-2.png',
      'element-3.png',
      'element-4.png',
    ]);
    expect(attachments.map((attachment) => attachment.uri)).toEqual([
      'data:image/png;base64,AAAA',
      'data:image/png;base64,BBBB',
      'data:image/png;base64,CCCC',
      'data:image/png;base64,DDDD',
    ]);
  });

  it('keeps the element ordinal when earlier elements have no shot', () => {
    const attachments = elementAttachments([
      capture('a'),
      capture('b'),
      capture('c'),
      capture('d'),
      capture('e', 'data:image/png;base64,EEEE'),
    ]);

    expect(attachments.map((attachment) => attachment.name)).toEqual(['element-5.png']);
  });
});
