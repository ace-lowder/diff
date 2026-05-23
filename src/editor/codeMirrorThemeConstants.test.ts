import { describe, expect, it } from 'vitest';

import {
  CODE_MIRROR_FONT_SIZE,
  CODE_MIRROR_LINE_HEIGHT,
} from './codeMirrorThemeConstants';

describe('code mirror theme constants', () => {
  it('uses the shared byline css font variables', () => {
    expect(CODE_MIRROR_FONT_SIZE).toBe('var(--byline-font-size)');
    expect(CODE_MIRROR_LINE_HEIGHT).toBe('var(--byline-line-height)');
  });
});
