import { normalizeFontStyleRanges, type FontStyleRange } from "./fontStyles";
import {
  DEFAULT_FONT_SIZE_MODE,
  isFontSizeMode,
} from './fontSize';
import type {
  FontSizeMode,
  LineGapMode,
  LineNumberPosition,
  LineNumberVisibilityMode,
  MenuPlacement,
  MenuVisibilityMode,
} from './appTypes';

export const DEFAULT_DRAFT_TEXT = `Welcome to byline: a text editor for authors with messy first drafts

This is the DRAFT view
1. Updates are highlighted red
2. Your work saves as you type
3. New lines will look patterned
4. no dotted lines will appear in the draft
5. Check out the bottom bar to track your word count, copy your drafts, and more`;

export const DEFAULT_EDITOR_TEXT = `Welcome to Byline: a text editor for authors who rewrite

This is the EDITOR view
1. Updates are highlighted green
2. Your work saves as you type

3. New lines will look green
4. a dotted line will appear below your last edit
5. Check out the bottom bar to track your word count, copy your drafts, and more`;

export const storageKeys = {
  draftText: "byline:draftText",
  editorText: "byline:editorText",
  draftFontStyleRanges: "byline:draftFontStyleRanges",
  editorFontStyleRanges: "byline:editorFontStyleRanges",
  menuPlacement: 'byline:menuPlacement',
  menuVisibilityMode: 'byline:menuVisibilityMode',
  lineNumberPosition: 'byline:lineNumberPosition',
  lineNumberVisibilityMode: 'byline:lineNumberVisibilityMode',
  fontSizeMode: 'byline:fontSizeMode',
  lineGapMode: 'byline:lineGapMode',
  wordWrappingEnabled: 'byline:wordWrappingEnabled',
} as const;

export type StoredDocumentText = {
  draftText: string;
  editorText: string;
};

export const getStoredDocumentText = (): StoredDocumentText => {
  try {
    const storedDraftText = window.localStorage.getItem(storageKeys.draftText);
    const storedEditorText = window.localStorage.getItem(storageKeys.editorText);

    const shouldUseTemplates =
      (storedDraftText === null && storedEditorText === null) ||
      (storedDraftText === "" && storedEditorText === "");

    if (shouldUseTemplates) {
      return {
        draftText: DEFAULT_DRAFT_TEXT,
        editorText: DEFAULT_EDITOR_TEXT,
      };
    }

    return {
      draftText: storedDraftText ?? "",
      editorText: storedEditorText ?? "",
    };
  } catch {
    return {
      draftText: DEFAULT_DRAFT_TEXT,
      editorText: DEFAULT_EDITOR_TEXT,
    };
  }
};

export const setStoredText = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredMenuPlacement = (): MenuPlacement => {
  try {
    const value = window.localStorage.getItem(storageKeys.menuPlacement);

    if (value === 'top' || value === 'bottom') {
      return value;
    }

    return 'responsive';
  } catch {
    return 'responsive';
  }
};

export const setStoredMenuPlacement = (placement: MenuPlacement): void => {
  try {
    if (placement === 'responsive') {
      window.localStorage.removeItem(storageKeys.menuPlacement);
      return;
    }

    window.localStorage.setItem(storageKeys.menuPlacement, placement);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredMenuVisibilityMode = (): MenuVisibilityMode => {
  try {
    const value = window.localStorage.getItem(storageKeys.menuVisibilityMode);

    if (value === 'visible' || value === 'autoHide') {
      return value;
    }

    return 'visible';
  } catch {
    return 'visible';
  }
};

export const setStoredMenuVisibilityMode = (
  visibilityMode: MenuVisibilityMode,
): void => {
  try {
    window.localStorage.setItem(storageKeys.menuVisibilityMode, visibilityMode);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredLineNumberPosition = (): LineNumberPosition => {
  try {
    const value = window.localStorage.getItem(storageKeys.lineNumberPosition);

    if (value === 'left' || value === 'right') {
      return value;
    }

    return 'left';
  } catch {
    return 'left';
  }
};

export const setStoredLineNumberPosition = (
  position: LineNumberPosition,
): void => {
  try {
    window.localStorage.setItem(storageKeys.lineNumberPosition, position);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredLineNumberVisibilityMode = (): LineNumberVisibilityMode => {
  try {
    const value = window.localStorage.getItem(
      storageKeys.lineNumberVisibilityMode,
    );

    if (value === 'visible' || value === 'autoHide') {
      return value;
    }

    return 'visible';
  } catch {
    return 'visible';
  }
};

export const setStoredLineNumberVisibilityMode = (
  visibilityMode: LineNumberVisibilityMode,
): void => {
  try {
    window.localStorage.setItem(
      storageKeys.lineNumberVisibilityMode,
      visibilityMode,
    );
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredFontSizeMode = (): FontSizeMode => {
  try {
    const value = window.localStorage.getItem(storageKeys.fontSizeMode);

    if (value && isFontSizeMode(value)) {
      return value;
    }

    return DEFAULT_FONT_SIZE_MODE;
  } catch {
    return DEFAULT_FONT_SIZE_MODE;
  }
};

export const setStoredFontSizeMode = (
  fontSizeMode: FontSizeMode,
): void => {
  try {
    window.localStorage.setItem(storageKeys.fontSizeMode, fontSizeMode);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredLineGapMode = (): LineGapMode => {
  try {
    const value = window.localStorage.getItem(storageKeys.lineGapMode);

    if (value === 'normal' || value === 'large') {
      return value;
    }

    return 'normal';
  } catch {
    return 'normal';
  }
};

export const setStoredLineGapMode = (lineGapMode: LineGapMode): void => {
  try {
    if (lineGapMode === 'normal') {
      window.localStorage.removeItem(storageKeys.lineGapMode);
      return;
    }

    window.localStorage.setItem(storageKeys.lineGapMode, lineGapMode);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredWordWrappingEnabled = (): boolean => {
  try {
    const value = window.localStorage.getItem(storageKeys.wordWrappingEnabled);

    if (value === 'false') {
      return false;
    }

    return true;
  } catch {
    return true;
  }
};

export const setStoredWordWrappingEnabled = (
  wordWrappingEnabled: boolean,
): void => {
  try {
    if (wordWrappingEnabled) {
      window.localStorage.removeItem(storageKeys.wordWrappingEnabled);
      return;
    }

    window.localStorage.setItem(storageKeys.wordWrappingEnabled, 'false');
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredFontStyleRanges = (key: string): FontStyleRange[] => {
  try {
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const ranges = parsedValue.filter(isFontStyleRange);
    return normalizeFontStyleRanges(ranges);
  } catch {
    return [];
  }
};

export const setStoredFontStyleRanges = (
  key: string,
  ranges: FontStyleRange[],
): void => {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(normalizeFontStyleRanges(ranges)),
    );
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const isFontStyleRange = (value: unknown): value is FontStyleRange => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const range = value as {
    type?: unknown;
    from?: unknown;
    to?: unknown;
  };

  const isKnownType =
    range.type === "bold" ||
    range.type === "italic" ||
    range.type === "underline";

  return (
    isKnownType &&
    typeof range.from === "number" &&
    typeof range.to === "number" &&
    Number.isFinite(range.from) &&
    Number.isFinite(range.to) &&
    range.to > range.from
  );
};
