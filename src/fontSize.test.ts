import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FONT_SIZE_MODE,
  FONT_SIZE_SETTINGS,
  getFontSizeCssVariables,
  getNextFontSizeMode,
  isFontSizeMode,
} from './fontSize';

describe('DEFAULT_FONT_SIZE_MODE', () => {
  it('is medium', () => {
    expect(DEFAULT_FONT_SIZE_MODE).toBe('medium');
  });
});

describe('FONT_SIZE_SETTINGS', () => {
  it('has exact small medium and large settings', () => {
    expect(FONT_SIZE_SETTINGS).toEqual({
      small: { fontSizePx: 10, lineHeightPx: 16, menuHeightPx: 32 },
      medium: { fontSizePx: 12, lineHeightPx: 18, menuHeightPx: 36 },
      large: { fontSizePx: 14, lineHeightPx: 21, menuHeightPx: 40 },
    });
  });
});

describe('isFontSizeMode', () => {
  it('accepts only small medium and large', () => {
    expect(isFontSizeMode('small')).toBe(true);
    expect(isFontSizeMode('medium')).toBe(true);
    expect(isFontSizeMode('large')).toBe(true);
    expect(isFontSizeMode('huge')).toBe(false);
    expect(isFontSizeMode('')).toBe(false);
  });
});

describe('getNextFontSizeMode', () => {
  it('cycles small to medium to large to small', () => {
    expect(getNextFontSizeMode('small')).toBe('medium');
    expect(getNextFontSizeMode('medium')).toBe('large');
    expect(getNextFontSizeMode('large')).toBe('small');
  });
});

describe('getFontSizeCssVariables', () => {
  it('returns medium css variables', () => {
    expect(getFontSizeCssVariables('medium')).toEqual({
      '--diff-font-size': '12px',
      '--diff-line-height': '18px',
      '--diff-menu-height': '36px',
    });
  });

  it('returns small and large menu heights', () => {
    expect(getFontSizeCssVariables('small')).toEqual({
      '--diff-font-size': '10px',
      '--diff-line-height': '16px',
      '--diff-menu-height': '32px',
    });

    expect(getFontSizeCssVariables('large')).toEqual({
      '--diff-font-size': '14px',
      '--diff-line-height': '21px',
      '--diff-menu-height': '40px',
    });
  });
});
