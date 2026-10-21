// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import routeEntry from '@/entrypoints/picker-route.content';

describe('picker route entrypoint', () => {
  it('runs in the MAIN world before the page scripts', () => {
    expect(routeEntry.world).toBe('MAIN');
    expect(routeEntry.runAt).toBe('document_start');
  });

  it('runs on every page and installs the emitter', () => {
    expect(routeEntry.matches).toEqual(['<all_urls>']);
    expect(typeof routeEntry.main).toBe('function');
  });
});
