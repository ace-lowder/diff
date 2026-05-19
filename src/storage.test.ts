import { describe, expect, it, beforeEach } from 'vitest';

import { getStoredText } from './storage';

describe('getStoredText', () => {
  const key = 'byline:test-key';
  const fallback = 'fallback value';
  const store = new Map<string, string>();

  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem(storageKey: string) {
        return store.has(storageKey) ? store.get(storageKey)! : null;
      },
      setItem(storageKey: string, value: string) {
        store.set(storageKey, value);
      },
      clear() {
        store.clear();
      },
    },
  };

  beforeEach(() => {
    store.clear();
  });

  it('returns fallback when key is missing', () => {
    expect(getStoredText({ key, fallback })).toBe(fallback);
  });

  it('returns fallback when value is empty string', () => {
    store.set(key, '');

    expect(getStoredText({ key, fallback })).toBe(fallback);
  });

  it('returns stored value when non-empty', () => {
    store.set(key, 'saved text');

    expect(getStoredText({ key, fallback })).toBe('saved text');
  });

  it('returns whitespace-only stored value', () => {
    store.set(key, ' \n');

    expect(getStoredText({ key, fallback })).toBe(' \n');
  });
});
