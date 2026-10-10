import type { PickerAriaFacts, PickerExtras } from './facts';

export const STYLE_PROPERTY_NAMES = [
  'display',
  'position',
  'z-index',
  'opacity',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'border-radius',
  'overflow',
  'cursor',
] as const;

export const MAX_STYLE_PROPERTIES = 8;
export const MAX_STYLE_VALUE_LENGTH = 60;
export const MAX_COMPONENT_NAME_LENGTH = 60;
export const MAX_ARIA_NAME_LENGTH = 120;

export interface RawAriaCapture {
  tag: string;
  role: string | null;
  inputType: string | null;
  hasHref: boolean;
  multiple: boolean;
  ariaLabelledBy: string | null;
  ariaLabel: string | null;
  labelText: string | null;
  alt: string | null;
  title: string | null;
  text: string;
}

export interface RawExtrasCapture {
  component: string | null;
  styles: Record<string, string>;
  aria: RawAriaCapture | null;
}

const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button',
  summary: 'button',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  form: 'form',
  table: 'table',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  dialog: 'dialog',
  img: 'img',
  progress: 'progressbar',
  textarea: 'textbox',
  hr: 'separator',
};

const INPUT_ROLES: Record<string, string> = {
  text: 'textbox',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  button: 'button',
  submit: 'button',
  reset: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
};

const TEXT_NAME_BLOCKED_TAGS = new Set([
  'input',
  'select',
  'textarea',
  'img',
  'svg',
  'canvas',
  'video',
  'audio',
  'iframe',
  'object',
  'embed',
  'area',
  'br',
  'hr',
  'meta',
  'script',
  'style',
  'link',
  'source',
  'track',
  'picture',
]);

export function pickStyleSubset(styles: Record<string, string>): Record<string, string> | null {
  const picked: Record<string, string> = {};
  let count = 0;
  for (const name of STYLE_PROPERTY_NAMES) {
    if (count >= MAX_STYLE_PROPERTIES) break;
    const raw = styles[name];
    if (typeof raw !== 'string') continue;
    const value = capText(raw, MAX_STYLE_VALUE_LENGTH);
    if (value.length === 0) continue;
    picked[name] = value;
    count += 1;
  }
  return count === 0 ? null : picked;
}

export function resolveAriaRole(input: RawAriaCapture): string | null {
  const explicit = input.role === null ? null : firstToken(input.role);
  if (explicit !== null) return explicit;
  const tag = input.tag.toLowerCase();
  if (tag === 'a') return input.hasHref ? 'link' : null;
  if (tag === 'input') {
    return input.inputType === null ? 'textbox' : (INPUT_ROLES[input.inputType.toLowerCase()] ?? null);
  }
  if (tag === 'select') return input.multiple ? 'listbox' : 'combobox';
  return IMPLICIT_ROLES[tag] ?? null;
}

export function resolveAccessibleName(input: RawAriaCapture): string | null {
  for (const candidate of [input.ariaLabelledBy, input.ariaLabel, input.labelText, input.alt, input.title]) {
    const value = candidate === null ? '' : capText(candidate, MAX_ARIA_NAME_LENGTH);
    if (value.length > 0) return value;
  }
  if (TEXT_NAME_BLOCKED_TAGS.has(input.tag.toLowerCase())) return null;
  const text = capText(input.text, MAX_ARIA_NAME_LENGTH);
  return text.length > 0 ? text : null;
}

export function resolveAria(input: RawAriaCapture): PickerAriaFacts | null {
  const aria: PickerAriaFacts = {};
  const role = resolveAriaRole(input);
  if (role !== null) aria.role = role;
  const name = resolveAccessibleName(input);
  if (name !== null) aria.name = name;
  return aria.role === undefined && aria.name === undefined ? null : aria;
}

export function assembleExtras(raw: RawExtrasCapture | undefined): PickerExtras | null {
  if (raw === undefined) return null;
  const extras: PickerExtras = {};
  const component = raw.component === null ? '' : capText(raw.component, MAX_COMPONENT_NAME_LENGTH);
  if (component.length > 0) extras.component = component;
  const styles = pickStyleSubset(raw.styles);
  if (styles !== null) extras.styles = styles;
  if (raw.aria !== null) {
    const aria = resolveAria(raw.aria);
    if (aria !== null) extras.aria = aria;
  }
  return Object.keys(extras).length === 0 ? null : extras;
}

function capText(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max)}…`;
}

function firstToken(value: string): string | null {
  const token = value.trim().split(/\s+/)[0];
  return token === undefined || token.length === 0 ? null : token;
}
