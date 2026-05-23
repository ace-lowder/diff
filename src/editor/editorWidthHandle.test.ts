import { describe, expect, it } from 'vitest';

import {
  EDITOR_WIDTH_HANDLE_RIGHT_NUDGE_PX,
  getEditorWidthHandleStyle,
} from './editorWidthHandle';

describe('EDITOR_WIDTH_HANDLE_RIGHT_NUDGE_PX', () => {
  it('is 2', () => {
    expect(EDITOR_WIDTH_HANDLE_RIGHT_NUDGE_PX).toBe(2);
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
    ).toEqual({ left: '56px' });
  });

  it('returns right style with gutter + scrollbar + nudge for beforeRightGutter placement', () => {
    expect(
      getEditorWidthHandleStyle({
        placement: 'beforeRightGutter',
        lineNumberGutterWidthPx: 56,
        scrollbarWidthPx: 12,
      }),
    ).toEqual({ right: '70px' });
  });
});
