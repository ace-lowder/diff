import { describe, expect, it } from 'vitest';

import {
  CODE_MIRROR_FONT_SIZE,
  CODE_MIRROR_LINE_HEIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH,
} from './codeMirrorThemeConstants';

describe('code mirror theme constants', () => {
  it('uses the shared Diff css font variables', () => {
    expect(CODE_MIRROR_FONT_SIZE).toBe('var(--diff-font-size)');
    expect(CODE_MIRROR_LINE_HEIGHT).toBe('var(--diff-line-height)');
  });

  it('uses the shared Diff line number gutter variables', () => {
    expect(CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH).toBe('6ch');
    expect(CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT).toBe('2ch');
  });
});
