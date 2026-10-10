import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { clearToken, getToken, setToken } from './auth';

const KEY_A = 'opencode@http://127.0.0.1:15001';
const KEY_B = 'opencode@http://127.0.0.1:4096';

describe('token storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty before pairing', async () => {
    expect(await getToken(KEY_A)).toBeNull();
  });

  it('stores and reads back the token under the connection key', async () => {
    await setToken(KEY_A, 'tok_123');

    expect(await getToken(KEY_A)).toBe('tok_123');
    expect(await browser.storage.local.get('auth.tokens')).toEqual({
      'auth.tokens': { [KEY_A]: 'tok_123' },
    });
  });

  it('keeps tokens for other connections apart', async () => {
    await setToken(KEY_A, 'tok_a');
    await setToken(KEY_B, 'tok_b');

    expect(await getToken(KEY_A)).toBe('tok_a');
    expect(await getToken(KEY_B)).toBe('tok_b');
  });

  it('clears one connection token and keeps the others', async () => {
    await setToken(KEY_A, 'tok_a');
    await setToken(KEY_B, 'tok_b');

    await clearToken(KEY_A);

    expect(await getToken(KEY_A)).toBeNull();
    expect(await getToken(KEY_B)).toBe('tok_b');
  });

  it('treats junk values as absent', async () => {
    await browser.storage.local.set({ 'auth.tokens': 42 });
    expect(await getToken(KEY_A)).toBeNull();

    await browser.storage.local.set({ 'auth.tokens': { [KEY_A]: 42 } });
    expect(await getToken(KEY_A)).toBeNull();
  });
});
