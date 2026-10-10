import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { bindProject, getBoundProject, getOriginBindings } from './projects';

describe('project bindings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('has no bindings initially', async () => {
    expect(await getOriginBindings()).toEqual({});
    expect(await getBoundProject('https://example.com')).toBeNull();
  });

  it('binds an origin to a project directory', async () => {
    await bindProject('https://example.com', '/home/afif/example');

    expect(await getBoundProject('https://example.com')).toBe('/home/afif/example');
  });

  it('keeps other origins when a new one is bound', async () => {
    await bindProject('https://example.com', '/home/afif/example');
    await bindProject('http://localhost:3000', '/home/afif/local');

    expect(await getOriginBindings()).toEqual({
      'https://example.com': '/home/afif/example',
      'http://localhost:3000': '/home/afif/local',
    });
  });

  it('rebinds an origin to a different project', async () => {
    await bindProject('https://example.com', '/home/afif/example');
    await bindProject('https://example.com', '/home/afif/other');

    expect(await getBoundProject('https://example.com')).toBe('/home/afif/other');
  });
});
