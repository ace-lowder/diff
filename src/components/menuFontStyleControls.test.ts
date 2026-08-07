import { beforeAll, describe, expect, it } from 'vitest';

import {
  FONT_STYLE_CONTROL_HOVER_CLASS_NAME,
  getFontStyleControlButtonClassName,
  getItalicFontStyleLabelClassName,
  UNDERLINE_FONT_STYLE_LABEL_CLASS_NAME,
} from './menuFontStyleControls';

describe('getFontStyleControlButtonClassName', () => {
  it('includes active classes for active buttons', () => {
    const className = getFontStyleControlButtonClassName(true);

    expect(className).toContain('bg-[#242526]');
    expect(className).toContain('text-[#D4D4D4]');
  });

  it('includes muted text class for inactive buttons', () => {
    const className = getFontStyleControlButtonClassName(false);

    expect(className).toContain('text-[#8C8C8C]');
  });

  it('includes the shared hover class for active buttons', () => {
    const className = getFontStyleControlButtonClassName(true);

    expect(className).toContain(FONT_STYLE_CONTROL_HOVER_CLASS_NAME);
  });

  it('includes the shared hover class for inactive buttons', () => {
    const className = getFontStyleControlButtonClassName(false);

    expect(className).toContain(FONT_STYLE_CONTROL_HOVER_CLASS_NAME);
  });

  it('does not include direct hover background or text classes when active', () => {
    const className = getFontStyleControlButtonClassName(true);

    expect(className).not.toContain('hover:bg-[#242526]');
    expect(className).not.toContain('hover:text-[#D4D4D4]');
  });

  it('does not include direct hover background or text classes when inactive', () => {
    const className = getFontStyleControlButtonClassName(false);

    expect(className).not.toContain('hover:bg-[#242526]');
    expect(className).not.toContain('hover:text-[#D4D4D4]');
  });
});

describe('getItalicFontStyleLabelClassName', () => {
  it('returns italic top-px for small', () => {
    expect(getItalicFontStyleLabelClassName('small')).toBe('italic top-px');
  });

  it('returns italic top-px for medium', () => {
    expect(getItalicFontStyleLabelClassName('medium')).toBe('italic top-px');
  });

  it('returns italic for large', () => {
    expect(getItalicFontStyleLabelClassName('large')).toBe('italic');
  });
});

describe('UNDERLINE_FONT_STYLE_LABEL_CLASS_NAME', () => {
  it('matches the expected underline label class', () => {
    expect(UNDERLINE_FONT_STYLE_LABEL_CLASS_NAME).toBe('text-[0.92em]');
  });
});

describe('font style hover css', () => {
  let indexCss = '';

  beforeAll(async () => {
    // @ts-expect-error Node typings are not included in app tsconfig.
    const { readFile } = await import('node:fs/promises');
    indexCss = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  });

  it('does not include background inherit hover override', () => {
    expect(indexCss).not.toContain('background-color: inherit;');
  });

  it('does not include color inherit hover override', () => {
    expect(indexCss).not.toContain('color: inherit;');
  });

  it('includes font style hover selector', () => {
    expect(indexCss).toContain('.diff-font-style-control-hover:hover');
  });

  it('includes fine pointer hover media query', () => {
    expect(indexCss).toContain('@media (any-hover: hover) and (any-pointer: fine)');
  });

  it('includes hover background color in media query', () => {
    expect(indexCss).toContain('background-color: #242526;');
  });

  it('includes hover text color in media query', () => {
    expect(indexCss).toContain('color: #D4D4D4;');
  });
});
