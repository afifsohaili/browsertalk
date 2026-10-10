import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { bindProject, getBoundProject, getOriginBindings } from './projects';

const KEY_A = 'opencode@http://127.0.0.1:15001';
const KEY_B = 'opencode@http://127.0.0.1:4096';

describe('project bindings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('has no bindings initially', async () => {
    expect(await getOriginBindings(KEY_A)).toEqual({});
    expect(await getBoundProject(KEY_A, 'https://example.com')).toBeNull();
  });

  it('binds an origin to a project directory', async () => {
    await bindProject(KEY_A, 'https://example.com', '/home/afif/example');

    expect(await getBoundProject(KEY_A, 'https://example.com')).toBe('/home/afif/example');
  });

  it('keeps other origins when a new one is bound', async () => {
    await bindProject(KEY_A, 'https://example.com', '/home/afif/example');
    await bindProject(KEY_A, 'http://localhost:3000', '/home/afif/local');

    expect(await getOriginBindings(KEY_A)).toEqual({
      'https://example.com': '/home/afif/example',
      'http://localhost:3000': '/home/afif/local',
    });
  });

  it('keeps the same origin apart per connection', async () => {
    await bindProject(KEY_A, 'https://example.com', '/home/afif/example');
    await bindProject(KEY_B, 'https://example.com', '/home/afif/other');

    expect(await getBoundProject(KEY_A, 'https://example.com')).toBe('/home/afif/example');
    expect(await getBoundProject(KEY_B, 'https://example.com')).toBe('/home/afif/other');
    expect(await browser.storage.local.get('projects.byOrigin')).toEqual({
      'projects.byOrigin': {
        [KEY_A]: { 'https://example.com': '/home/afif/example' },
        [KEY_B]: { 'https://example.com': '/home/afif/other' },
      },
    });
  });

  it('never falls back to another connection binding', async () => {
    await bindProject(KEY_A, 'https://example.com', '/home/afif/example');

    expect(await getBoundProject(KEY_B, 'https://example.com')).toBeNull();
    expect(await getOriginBindings(KEY_B)).toEqual({});
  });

  it('rebinds an origin to a different project', async () => {
    await bindProject(KEY_A, 'https://example.com', '/home/afif/example');
    await bindProject(KEY_A, 'https://example.com', '/home/afif/other');

    expect(await getBoundProject(KEY_A, 'https://example.com')).toBe('/home/afif/other');
  });

  it('keeps concurrent bindings for two origins', async () => {
    await Promise.all([
      bindProject(KEY_A, 'https://first.example', '/home/afif/first'),
      bindProject(KEY_A, 'https://second.example', '/home/afif/second'),
    ]);

    expect(await getOriginBindings(KEY_A)).toEqual({
      'https://first.example': '/home/afif/first',
      'https://second.example': '/home/afif/second',
    });
  });

  it('ignores junk values', async () => {
    await browser.storage.local.set({ 'projects.byOrigin': 42 });
    expect(await getOriginBindings(KEY_A)).toEqual({});

    await browser.storage.local.set({ 'projects.byOrigin': { [KEY_A]: 'nonsense' } });
    expect(await getOriginBindings(KEY_A)).toEqual({});

    await browser.storage.local.set({ 'projects.byOrigin': { [KEY_A]: { 'https://example.com': 7 } } });
    expect(await getOriginBindings(KEY_A)).toEqual({});
  });
});
