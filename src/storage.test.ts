import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DRAFT_TEXT,
  DEFAULT_EDITOR_TEXT,
  getStoredDocumentText,
  getStoredMenuPlacement,
  setStoredMenuPlacement,
  storageKeys,
} from './storage';

const store = new Map<string, string>();

(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem(storageKey: string) {
      return store.has(storageKey) ? store.get(storageKey)! : null;
    },
    setItem(storageKey: string, value: string) {
      store.set(storageKey, value);
    },
    removeItem(storageKey: string) {
      store.delete(storageKey);
    },
    clear() {
      store.clear();
    },
  },
};

beforeEach(() => {
  store.clear();
});

describe('getStoredDocumentText', () => {
  it('returns both templates when both keys are missing', () => {
    expect(getStoredDocumentText()).toEqual({
      draftText: DEFAULT_DRAFT_TEXT,
      editorText: DEFAULT_EDITOR_TEXT,
    });
  });

  it('returns both templates when both values are empty strings', () => {
    store.set(storageKeys.draftText, '');
    store.set(storageKeys.editorText, '');

    expect(getStoredDocumentText()).toEqual({
      draftText: DEFAULT_DRAFT_TEXT,
      editorText: DEFAULT_EDITOR_TEXT,
    });
  });

  it('returns saved draft and empty editor when draft has content and editor is empty', () => {
    store.set(storageKeys.draftText, 'saved draft');
    store.set(storageKeys.editorText, '');

    expect(getStoredDocumentText()).toEqual({
      draftText: 'saved draft',
      editorText: '',
    });
  });

  it('returns empty draft and saved editor when draft is empty and editor has content', () => {
    store.set(storageKeys.draftText, '');
    store.set(storageKeys.editorText, 'saved editor');

    expect(getStoredDocumentText()).toEqual({
      draftText: '',
      editorText: 'saved editor',
    });
  });

  it('returns both saved values when both have content', () => {
    store.set(storageKeys.draftText, 'saved draft');
    store.set(storageKeys.editorText, 'saved editor');

    expect(getStoredDocumentText()).toEqual({
      draftText: 'saved draft',
      editorText: 'saved editor',
    });
  });

  it('returns whitespace-only values as saved content', () => {
    store.set(storageKeys.draftText, ' \n');
    store.set(storageKeys.editorText, '\n\t');

    expect(getStoredDocumentText()).toEqual({
      draftText: ' \n',
      editorText: '\n\t',
    });
  });

  it('returns empty string for missing side when other side has content', () => {
    store.set(storageKeys.editorText, 'saved editor');

    expect(getStoredDocumentText()).toEqual({
      draftText: '',
      editorText: 'saved editor',
    });
  });

  it('returns templates when localStorage getItem throws', () => {
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('boom');
    };

    try {
      expect(getStoredDocumentText()).toEqual({
        draftText: DEFAULT_DRAFT_TEXT,
        editorText: DEFAULT_EDITOR_TEXT,
      });
    } finally {
      window.localStorage.getItem = originalGetItem;
    }
  });
});

describe('menu placement storage', () => {
  it('returns responsive when menu placement is missing', () => {
    expect(getStoredMenuPlacement()).toBe('responsive');
  });

  it('returns top when top is stored', () => {
    store.set(storageKeys.menuPlacement, 'top');
    expect(getStoredMenuPlacement()).toBe('top');
  });

  it('returns bottom when bottom is stored', () => {
    store.set(storageKeys.menuPlacement, 'bottom');
    expect(getStoredMenuPlacement()).toBe('bottom');
  });

  it('returns responsive for invalid stored value', () => {
    store.set(storageKeys.menuPlacement, 'left');
    expect(getStoredMenuPlacement()).toBe('responsive');
  });

  it('stores top placement', () => {
    setStoredMenuPlacement('top');
    expect(store.get(storageKeys.menuPlacement)).toBe('top');
  });

  it('stores bottom placement', () => {
    setStoredMenuPlacement('bottom');
    expect(store.get(storageKeys.menuPlacement)).toBe('bottom');
  });

  it('removes stored value for responsive placement', () => {
    store.set(storageKeys.menuPlacement, 'top');
    setStoredMenuPlacement('responsive');
    expect(store.has(storageKeys.menuPlacement)).toBe(false);
  });

  it('falls back safely when storage access fails', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    const originalRemoveItem = window.localStorage.removeItem;

    window.localStorage.getItem = () => {
      throw new Error('get-failed');
    };
    window.localStorage.setItem = () => {
      throw new Error('set-failed');
    };
    window.localStorage.removeItem = () => {
      throw new Error('remove-failed');
    };

    try {
      expect(getStoredMenuPlacement()).toBe('responsive');
      expect(() => setStoredMenuPlacement('top')).not.toThrow();
      expect(() => setStoredMenuPlacement('responsive')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    }
  });
});
