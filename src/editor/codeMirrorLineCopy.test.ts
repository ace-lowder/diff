import { describe, expect, it } from 'vitest';

import {
  LINE_COPY_ICON_CLASS_NAME,
  LINE_COPY_ICON_FADE_MS,
  LINE_COPY_ICON_FADING_CLASS_NAME,
  getLineCopyIconMarkup,
} from './codeMirrorLineCopy';

describe('line copy icon constants', () => {
  it('uses a 300ms icon fade duration', () => {
    expect(LINE_COPY_ICON_FADE_MS).toBe(300);
  });

  it('uses expected icon class names', () => {
    expect(LINE_COPY_ICON_CLASS_NAME).toBe('byline-line-copy-icon');
    expect(LINE_COPY_ICON_FADING_CLASS_NAME).toBe('byline-line-copy-icon-fading');
  });
});

describe('getLineCopyIconMarkup', () => {
  it('contains the copy icon rectangle and path', () => {
    const markup = getLineCopyIconMarkup();

    expect(markup).toContain('<rect x="9" y="9" width="13" height="13"');
    expect(markup).toContain('<path d="M5 15H4');
    expect(markup).not.toContain('m5 13 4 4L19 7');
  });
});
