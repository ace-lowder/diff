import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DRAFT_TEXT,
  DEFAULT_EDITOR_TEXT,
  getStoredDocumentText,
  getStoredFontSizeMode,
  getStoredLineGapMode,
  getStoredLineNumberPosition,
  getStoredLineNumberVisibilityMode,
  getStoredMenuPlacement,
  getStoredMenuVisibilityMode,
  getStoredWordWrappingEnabled,
  setStoredFontSizeMode,
  setStoredLineGapMode,
  setStoredLineNumberPosition,
  setStoredLineNumberVisibilityMode,
  setStoredMenuPlacement,
  setStoredMenuVisibilityMode,
  setStoredWordWrappingEnabled,
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

describe('menu visibility mode storage', () => {
  it('returns visible when value is missing', () => {
    expect(getStoredMenuVisibilityMode()).toBe('visible');
  });

  it('returns visible when visible is stored', () => {
    store.set(storageKeys.menuVisibilityMode, 'visible');
    expect(getStoredMenuVisibilityMode()).toBe('visible');
  });

  it('returns autoHide when autoHide is stored', () => {
    store.set(storageKeys.menuVisibilityMode, 'autoHide');
    expect(getStoredMenuVisibilityMode()).toBe('autoHide');
  });

  it('returns visible for invalid stored value', () => {
    store.set(storageKeys.menuVisibilityMode, 'weird');
    expect(getStoredMenuVisibilityMode()).toBe('visible');
  });

  it('stores visible', () => {
    setStoredMenuVisibilityMode('visible');
    expect(store.get(storageKeys.menuVisibilityMode)).toBe('visible');
  });

  it('stores autoHide', () => {
    setStoredMenuVisibilityMode('autoHide');
    expect(store.get(storageKeys.menuVisibilityMode)).toBe('autoHide');
  });

  it('falls back safely when storage access fails', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = () => {
      throw new Error('get-failed');
    };
    window.localStorage.setItem = () => {
      throw new Error('set-failed');
    };

    try {
      expect(getStoredMenuVisibilityMode()).toBe('visible');
      expect(() => setStoredMenuVisibilityMode('visible')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('line number position storage', () => {
  it('returns left when value is missing', () => {
    expect(getStoredLineNumberPosition()).toBe('left');
  });

  it('returns left when left is stored', () => {
    store.set(storageKeys.lineNumberPosition, 'left');
    expect(getStoredLineNumberPosition()).toBe('left');
  });

  it('returns right when right is stored', () => {
    store.set(storageKeys.lineNumberPosition, 'right');
    expect(getStoredLineNumberPosition()).toBe('right');
  });

  it('returns left for invalid stored value', () => {
    store.set(storageKeys.lineNumberPosition, 'middle');
    expect(getStoredLineNumberPosition()).toBe('left');
  });

  it('stores left', () => {
    setStoredLineNumberPosition('left');
    expect(store.get(storageKeys.lineNumberPosition)).toBe('left');
  });

  it('stores right', () => {
    setStoredLineNumberPosition('right');
    expect(store.get(storageKeys.lineNumberPosition)).toBe('right');
  });

  it('falls back safely when storage access fails', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = () => {
      throw new Error('get-failed');
    };
    window.localStorage.setItem = () => {
      throw new Error('set-failed');
    };

    try {
      expect(getStoredLineNumberPosition()).toBe('left');
      expect(() => setStoredLineNumberPosition('left')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('line number visibility mode storage', () => {
  it('returns visible when value is missing', () => {
    expect(getStoredLineNumberVisibilityMode()).toBe('visible');
  });

  it('returns visible when visible is stored', () => {
    store.set(storageKeys.lineNumberVisibilityMode, 'visible');
    expect(getStoredLineNumberVisibilityMode()).toBe('visible');
  });

  it('returns autoHide when autoHide is stored', () => {
    store.set(storageKeys.lineNumberVisibilityMode, 'autoHide');
    expect(getStoredLineNumberVisibilityMode()).toBe('autoHide');
  });

  it('returns visible for invalid stored value', () => {
    store.set(storageKeys.lineNumberVisibilityMode, 'invalid');
    expect(getStoredLineNumberVisibilityMode()).toBe('visible');
  });

  it('stores visible', () => {
    setStoredLineNumberVisibilityMode('visible');
    expect(store.get(storageKeys.lineNumberVisibilityMode)).toBe('visible');
  });

  it('stores autoHide', () => {
    setStoredLineNumberVisibilityMode('autoHide');
    expect(store.get(storageKeys.lineNumberVisibilityMode)).toBe('autoHide');
  });

  it('falls back safely when storage access fails', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = () => {
      throw new Error('get-failed');
    };
    window.localStorage.setItem = () => {
      throw new Error('set-failed');
    };

    try {
      expect(getStoredLineNumberVisibilityMode()).toBe('visible');
      expect(() => setStoredLineNumberVisibilityMode('visible')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('font size mode storage', () => {
  it('returns medium when value is missing', () => {
    expect(getStoredFontSizeMode()).toBe('medium');
  });

  it('returns small when small is stored', () => {
    store.set(storageKeys.fontSizeMode, 'small');
    expect(getStoredFontSizeMode()).toBe('small');
  });

  it('returns medium when medium is stored', () => {
    store.set(storageKeys.fontSizeMode, 'medium');
    expect(getStoredFontSizeMode()).toBe('medium');
  });

  it('returns large when large is stored', () => {
    store.set(storageKeys.fontSizeMode, 'large');
    expect(getStoredFontSizeMode()).toBe('large');
  });

  it('returns medium for invalid stored value', () => {
    store.set(storageKeys.fontSizeMode, 'huge');
    expect(getStoredFontSizeMode()).toBe('medium');
  });

  it('stores the mode', () => {
    setStoredFontSizeMode('large');
    expect(store.get(storageKeys.fontSizeMode)).toBe('large');
  });

  it('falls back safely when storage access fails', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = () => {
      throw new Error('get-failed');
    };
    window.localStorage.setItem = () => {
      throw new Error('set-failed');
    };

    try {
      expect(getStoredFontSizeMode()).toBe('medium');
      expect(() => setStoredFontSizeMode('small')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('line gap mode storage', () => {
  it('returns normal when value is missing', () => {
    expect(getStoredLineGapMode()).toBe('normal');
  });

  it('returns normal when normal is stored', () => {
    store.set(storageKeys.lineGapMode, 'normal');
    expect(getStoredLineGapMode()).toBe('normal');
  });

  it('returns large when large is stored', () => {
    store.set(storageKeys.lineGapMode, 'large');
    expect(getStoredLineGapMode()).toBe('large');
  });

  it('returns normal for invalid stored value', () => {
    store.set(storageKeys.lineGapMode, 'wide');
    expect(getStoredLineGapMode()).toBe('normal');
  });

  it('stores large and removes normal', () => {
    setStoredLineGapMode('large');
    expect(store.get(storageKeys.lineGapMode)).toBe('large');

    setStoredLineGapMode('normal');
    expect(store.has(storageKeys.lineGapMode)).toBe(false);
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
      expect(getStoredLineGapMode()).toBe('normal');
      expect(() => setStoredLineGapMode('large')).not.toThrow();
      expect(() => setStoredLineGapMode('normal')).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    }
  });
});

describe('word wrapping storage', () => {
  it('defaults to enabled when value is missing', () => {
    expect(getStoredWordWrappingEnabled()).toBe(true);
  });

  it('returns false when disabled is stored', () => {
    store.set(storageKeys.wordWrappingEnabled, 'false');
    expect(getStoredWordWrappingEnabled()).toBe(false);
  });

  it('returns true for invalid stored value', () => {
    store.set(storageKeys.wordWrappingEnabled, 'maybe');
    expect(getStoredWordWrappingEnabled()).toBe(true);
  });

  it('stores false and removes true', () => {
    setStoredWordWrappingEnabled(false);
    expect(store.get(storageKeys.wordWrappingEnabled)).toBe('false');

    setStoredWordWrappingEnabled(true);
    expect(store.has(storageKeys.wordWrappingEnabled)).toBe(false);
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
      expect(getStoredWordWrappingEnabled()).toBe(true);
      expect(() => setStoredWordWrappingEnabled(false)).not.toThrow();
      expect(() => setStoredWordWrappingEnabled(true)).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    }
  });
});
