import { describe, expect, it } from 'vitest';

import {
  FONT_STYLE_CONTROL_HOVER_CLASS_NAME,
  getFontStyleControlButtonClassName,
  ITALIC_FONT_STYLE_LABEL_CLASS_NAME,
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

describe('ITALIC_FONT_STYLE_LABEL_CLASS_NAME', () => {
  it('matches the expected italic label class', () => {
    expect(ITALIC_FONT_STYLE_LABEL_CLASS_NAME).toBe('italic top-px');
  });
});
