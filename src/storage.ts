import { normalizeFontStyleRanges, type FontStyleRange } from "./fontStyles";
import {
  DEFAULT_FONT_SIZE_MODE,
  isFontSizeMode,
} from './fontSize';
import type {
  AppMode,
  FontSizeMode,
  LineGapMode,
  LineNumberPosition,
  LineNumberVisibilityMode,
  MenuPlacement,
  MenuVisibilityMode,
} from './appTypes';

export const DEFAULT_DRAFT_TEXT = `88888888ba,    88     ad88     ad88
88      \`"8b   ""    d8"      d8"
88        \`8b        88       88
88         88  88  MM88MMM  MM88MMM
88         88  88    88       88
88         8P  88    88       88
88      .a8P   88    88       88
88888888Y"'    88    88       88

view the differences in your drafts`;

export const DEFAULT_EDITOR_TEXT = `88888888ba,    88     ad88     ad88
88      \`"8b   ""    d8"      d8"
88        \`8b        88       88
88         88  88  MM88MMM  MM88MMM
88         88  88    88       88
88         8P  88    88       88
88      .a8P   88    88       88
88888888Y"'    88    88       88

view the changes in your drafts!
- type / on a new line for more commands`;

export const storageKeys = {
  draftText: "diff:draftText",
  editorText: "diff:editorText",
  draftFontStyleRanges: "diff:draftFontStyleRanges",
  editorFontStyleRanges: "diff:editorFontStyleRanges",
  menuPlacement: 'diff:menuPlacement',
  menuVisibilityMode: 'diff:menuVisibilityMode',
  lineNumberPosition: 'diff:lineNumberPosition',
  lineNumberVisibilityMode: 'diff:lineNumberVisibilityMode',
  fontSizeMode: 'diff:fontSizeMode',
  lineGapMode: 'diff:lineGapMode',
  wordWrappingEnabled: 'diff:wordWrappingEnabled',
  appMode: 'diff:appMode',
} as const;

export const legacyStorageKeys = {
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
  appMode: 'byline:appMode',
} as const;

const legacyStorageKeyByKey = new Map<string, string>(
  Object.keys(storageKeys).map((keyName) => {
    const typedKeyName = keyName as keyof typeof storageKeys;
    return [storageKeys[typedKeyName], legacyStorageKeys[typedKeyName]];
  }),
);

export type StoredDocumentText = {
  draftText: string;
  editorText: string;
};

export const getStoredDocumentText = (): StoredDocumentText => {
  try {
    const storedDraftText = getStoredItem(storageKeys.draftText);
    const storedEditorText = getStoredItem(storageKeys.editorText);

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
    const value = getStoredItem(storageKeys.menuPlacement);

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
    const value = getStoredItem(storageKeys.menuVisibilityMode);

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
    const value = getStoredItem(storageKeys.lineNumberPosition);

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
    const value = getStoredItem(
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
    const value = getStoredItem(storageKeys.fontSizeMode);

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

export const getStoredAppMode = (): AppMode => {
  try {
    const value = getStoredItem(storageKeys.appMode);

    if (value === 'draft' || value === 'editor' || value === 'split') {
      return value;
    }

    return 'split';
  } catch {
    return 'split';
  }
};

export const getInitialAppMode = (
  documentText: StoredDocumentText,
): AppMode => {
  const isStarterText =
    documentText.draftText === DEFAULT_DRAFT_TEXT &&
    documentText.editorText === DEFAULT_EDITOR_TEXT;

  return isStarterText ? 'split' : getStoredAppMode();
};

export const setStoredAppMode = (mode: AppMode): void => {
  try {
    if (mode === 'split') {
      window.localStorage.removeItem(storageKeys.appMode);
      return;
    }

    window.localStorage.setItem(storageKeys.appMode, mode);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

export const getStoredLineGapMode = (): LineGapMode => {
  try {
    const value = getStoredItem(storageKeys.lineGapMode);

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
    const value = getStoredItem(storageKeys.wordWrappingEnabled);

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
    const storedValue = getStoredItem(key);

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

const getStoredItem = (key: string): string | null => {
  const storedValue = window.localStorage.getItem(key);
  const legacyKey = legacyStorageKeyByKey.get(key);

  if (storedValue !== null) {
    if (legacyKey) {
      try {
        window.localStorage.removeItem(legacyKey);
      } catch {
        // Keep the current Diff value when legacy cleanup fails.
      }
    }

    return storedValue;
  }

  if (!legacyKey) {
    return null;
  }

  const legacyValue = window.localStorage.getItem(legacyKey);
  if (legacyValue === null) {
    return null;
  }

  try {
    window.localStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Return the legacy value even when migration cannot be saved.
  }

  return legacyValue;
};
