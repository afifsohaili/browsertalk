import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { clearToken, getToken, setToken } from './auth';

describe('token storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty before pairing', async () => {
    expect(await getToken()).toBeNull();
  });

  it('stores and reads back the token under auth.token', async () => {
    await setToken('tok_123');

    expect(await getToken()).toBe('tok_123');
    expect(await browser.storage.local.get('auth.token')).toEqual({ 'auth.token': 'tok_123' });
  });

  it('clears the token', async () => {
    await setToken('tok_123');
    await clearToken();

    expect(await getToken()).toBeNull();
  });

  it('treats junk values as absent', async () => {
    await browser.storage.local.set({ 'auth.token': 42 });

    expect(await getToken()).toBeNull();
  });
});
