import { describe, expect, it } from 'vitest';

import {
  CODE_MIRROR_FONT_SIZE,
  CODE_MIRROR_LINE_HEIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH,
} from './codeMirrorThemeConstants';

describe('code mirror theme constants', () => {
  it('uses the shared byline css font variables', () => {
    expect(CODE_MIRROR_FONT_SIZE).toBe('var(--byline-font-size)');
    expect(CODE_MIRROR_LINE_HEIGHT).toBe('var(--byline-line-height)');
  });

  it('uses the shared byline line number gutter variables', () => {
    expect(CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH).toBe(
      'var(--byline-line-number-gutter-width)',
    );
    expect(CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT).toBe('12px');
  });
});
