import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DRAFT_TEXT,
  DEFAULT_EDITOR_TEXT,
  getStoredDocumentText,
  storageKeys,
} from './storage';

describe('getStoredDocumentText', () => {
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
