import { normalizeFontStyleRanges, type FontStyleRange } from './fontStyles';

export const storageKeys = {
  draftText: 'byline:draftText',
  editorText: 'byline:editorText',
  draftFontStyleRanges: 'byline:draftFontStyleRanges',
  editorFontStyleRanges: 'byline:editorFontStyleRanges',
} as const;

export const getStoredText = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
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
