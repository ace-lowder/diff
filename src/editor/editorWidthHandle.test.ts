import { describe, expect, it } from 'vitest';

import { RIGHT_RESIZE_HANDLE_NUDGE_PX } from '../layoutTuning';
import { getEditorWidthHandleStyle } from './editorWidthHandle';

describe('RIGHT_RESIZE_HANDLE_NUDGE_PX', () => {
  it('is 12', () => {
    expect(RIGHT_RESIZE_HANDLE_NUDGE_PX).toBe(12);
  });
});

describe('getEditorWidthHandleStyle', () => {
  it('returns left style for afterLeftGutter placement', () => {
    expect(
      getEditorWidthHandleStyle({
        placement: 'afterLeftGutter',
        lineNumberGutterWidthPx: 56,
        scrollbarWidthPx: 12,
      }),
    ).toEqual({ left: '68px' });
  });

  it('returns right style with gutter + scrollbar + nudge for beforeRightGutter placement', () => {
    expect(
      getEditorWidthHandleStyle({
        placement: 'beforeRightGutter',
        lineNumberGutterWidthPx: 56,
        scrollbarWidthPx: 12,
      }),
    ).toEqual({ right: '80px' });
  });
});
