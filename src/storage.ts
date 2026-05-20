import { normalizeFontStyleRanges, type FontStyleRange } from './fontStyles';

export const DEFAULT_DRAFT_TEXT = `Welcome to byline: a text editor for authors with messy first drafts

This is the DRAFT view
1. Updates are highlighted red
2. Your work saves as you type
3. New lines will look patterned
4. no dotted lines will appear in the draft
5. Check out the bottom bar to track your word count, copy your drafts, and more

---`;

export const DEFAULT_EDITOR_TEXT = `Welcome to Byline: a text editor for authors who rewrite

This is the EDITOR view
1. Updates are highlighted green
2. Your work saves as you type

3. New lines will look green
4. a dotted line will appear below your last edit
5. Check out the bottom bar to track your word count, copy your drafts, and more`;

export const storageKeys = {
  draftText: 'byline:draftText',
  editorText: 'byline:editorText',
  draftFontStyleRanges: 'byline:draftFontStyleRanges',
  editorFontStyleRanges: 'byline:editorFontStyleRanges',
} as const;

export const getStoredText = ({
  key,
  fallback,
}: {
  key: string;
  fallback: string;
}): string => {
  try {
    const storedValue = window.localStorage.getItem(key);

    if (storedValue === null || storedValue === '') {
      return fallback;
    }

    return storedValue;
  } catch {
    return fallback;
  }
};

export const setStoredText = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
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
  if (!value || typeof value !== 'object') {
    return false;
  }

  const range = value as {
    type?: unknown;
    from?: unknown;
    to?: unknown;
  };

  const isKnownType =
    range.type === 'bold' || range.type === 'italic' || range.type === 'underline';

  return (
    isKnownType &&
    typeof range.from === 'number' &&
    typeof range.to === 'number' &&
    Number.isFinite(range.from) &&
    Number.isFinite(range.to) &&
    range.to > range.from
  );
};
