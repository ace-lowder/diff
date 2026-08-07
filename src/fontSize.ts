import type { CSSProperties } from 'react';

import type { FontSizeMode } from './appTypes';

export const DEFAULT_FONT_SIZE_MODE: FontSizeMode = 'medium';

export const FONT_SIZE_MODES: FontSizeMode[] = ['small', 'medium', 'large'];

export const FONT_SIZE_SETTINGS: Record<
  FontSizeMode,
  {
    fontSizePx: number;
    lineHeightPx: number;
    menuHeightPx: number;
  }
> = {
  small: { fontSizePx: 10, lineHeightPx: 16, menuHeightPx: 32 },
  medium: { fontSizePx: 12, lineHeightPx: 18, menuHeightPx: 36 },
  large: { fontSizePx: 14, lineHeightPx: 21, menuHeightPx: 40 },
};

export const isFontSizeMode = (value: string): value is FontSizeMode => {
  return value === 'small' || value === 'medium' || value === 'large';
};

export const getNextFontSizeMode = (
  fontSizeMode: FontSizeMode,
): FontSizeMode => {
  if (fontSizeMode === 'small') {
    return 'medium';
  }

  if (fontSizeMode === 'medium') {
    return 'large';
  }

  return 'small';
};

type FontSizeCssVariables = CSSProperties & {
  '--diff-font-size': string;
  '--diff-line-height': string;
  '--diff-menu-height': string;
};

export const getFontSizeCssVariables = (
  fontSizeMode: FontSizeMode,
): FontSizeCssVariables => {
  const settings = FONT_SIZE_SETTINGS[fontSizeMode];

  return {
    '--diff-font-size': `${settings.fontSizePx}px`,
    '--diff-line-height': `${settings.lineHeightPx}px`,
    '--diff-menu-height': `${settings.menuHeightPx}px`,
  };
};
