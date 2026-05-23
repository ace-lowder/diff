import { describe, expect, it } from 'vitest';

import type { DraftHighlightRange, DraftLineDecoration, EditorHighlightRange } from '../editorDiff';
import {
  getDiffPaintEffectValue,
  getDiffPaintTargets,
  getLineBoundedRangeSegments,
  getMarkerTargetsOutsideInlineRangeInteriors,
  getNonWidgetTextBlocks,
  isMarkerInsideInlineRange,
  getVisualRowRangeSegments,
  getVisualLineBox,
  type DiffPaintState,
} from './codeMirrorDiffPaint';
import {
  DIFF_PAINT_GEOMETRY,
  DIFF_FULL_LINE_LEFT_OFFSET_PX,
  DIFF_FULL_LINE_RIGHT_OFFSET_PX,
  getAdjustedPaintRectBox,
  getLinePaintGeometryAdjustment,
  getLowestEditedLineRuleBox,
  LOWEST_EDITED_LINE_HEIGHT_PX,
} from './codeMirrorDiffPaintGeometry';

const BASE_TEXT = 'one\ntwo\nthree';

const getTargets = ({
  theme,
  editorHighlightRanges = [],
  draftHighlightRanges = [],
  editorLineDecorations = [],
  draftLineDecorations = [],
}: {
  theme: 'draft' | 'editor';
  editorHighlightRanges?: EditorHighlightRange[];
  draftHighlightRanges?: DraftHighlightRange[];
  editorLineDecorations?: { lineNumber: number }[];
  draftLineDecorations?: DraftLineDecoration[];
}) => {
  const diffPaint: DiffPaintState = {
    editorHighlightRanges,
    draftHighlightRanges,
    editorLineDecorations,
    draftLineDecorations,
    lowestEditedLine: null,
  };

  return getDiffPaintTargets({
    theme,
    text: BASE_TEXT,
    docLineCount: 3,
    activeLineNumber: 2,
    diffPaint,
  });
};

describe('getDiffPaintTargets', () => {
  it('maps editor added range to added paint range', () => {
    const targets = getTargets({
      theme: 'editor',
      editorHighlightRanges: [{ type: 'added', from: 0, to: 3 }],
    });

    expect(targets).toContainEqual({
      type: 'range',
      className: 'byline-diff-added',
      from: 0,
      to: 3,
      geometryRole: 'inlineText',
    });
  });

  it('maps editor deleted zero-width range to deleted marker target', () => {
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: 'onetwo',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [{ type: 'deleted', from: 3, to: 3 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(targets).toContainEqual({
      type: 'marker',
      className: 'byline-diff-deleted',
      from: 3,
      to: 4,
      side: 'left',
      position: 3,
      geometryRole: 'tick',
    });
  });

  it('maps editor line decorations to added line targets', () => {
    const targets = getTargets({
      theme: 'editor',
      editorLineDecorations: [{ lineNumber: 2 }],
    });

    expect(targets).toContainEqual({
      type: 'line',
      className: 'byline-diff-added',
      lineNumber: 2,
      geometryRole: 'fullLine',
    });
  });

  it('maps draft deleted range to deleted paint range', () => {
    const targets = getTargets({
      theme: 'draft',
      draftHighlightRanges: [{ type: 'deleted', from: 4, to: 7 }],
    });

    expect(targets).toContainEqual({
      type: 'range',
      className: 'byline-diff-deleted',
      from: 4,
      to: 7,
      geometryRole: 'inlineText',
    });
  });

  it('maps draft added zero-width range to added marker target', () => {
    const targets = getDiffPaintTargets({
      theme: 'draft',
      text: 'onetwo',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [{ type: 'added', from: 3, to: 3 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(targets).toContainEqual({
      type: 'marker',
      className: 'byline-diff-added',
      from: 3,
      to: 4,
      side: 'left',
      position: 3,
      geometryRole: 'tick',
    });
  });

  it('maps deletedDraftLine to deleted line target', () => {
    const targets = getTargets({
      theme: 'draft',
      draftLineDecorations: [
        { type: 'deletedDraftLine', lineNumber: 3, placement: 'before' },
      ],
    });

    expect(targets).toContainEqual({
      type: 'line',
      className: 'byline-diff-deleted',
      lineNumber: 3,
      geometryRole: 'fullLine',
    });
  });

  it('does not map missingEditorLine to line target', () => {
    const targets = getTargets({
      theme: 'draft',
      draftLineDecorations: [
        {
          type: 'missingEditorLine',
          lineNumber: 2,
          placement: 'before',
          lineCount: 1,
        },
      ],
    });

    expect(
      targets.some((target) => {
        return target.type === 'line' && target.className === 'byline-diff-added';
      }),
    ).toBe(false);
    expect(
      targets.some((target) => {
        return target.type === 'line' && target.className === 'byline-diff-deleted';
      }),
    ).toBe(false);
  });

  it('skips invalid ranges', () => {
    const targets = getTargets({
      theme: 'editor',
      editorHighlightRanges: [
        { type: 'added', from: -5, to: -1 },
        { type: 'deleted', from: 999, to: 999 },
      ],
      editorLineDecorations: [{ lineNumber: 99 }],
    });

    expect(targets).toEqual([
      {
        type: 'line',
        className: 'byline-diff-active-line',
        lineNumber: 2,
        geometryRole: 'activeLine',
      },
    ]);
  });

  it('uses draft active line tuning in draft pane', () => {
    const targets = getTargets({ theme: 'draft' });
    expect(targets[0]).toEqual({
      type: 'line',
      className: 'byline-diff-active-line',
      lineNumber: 2,
      geometryRole: 'activeLine',
    });
  });

  it('editor skips interior deleted marker inside added range', () => {
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 5 },
          { type: 'deleted', from: 3, to: 3 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 3;
      }),
    ).toBe(false);
  });

  it('editor keeps deleted marker at added range start', () => {
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 5 },
          { type: 'deleted', from: 1, to: 1 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 1;
      }),
    ).toBe(true);
  });

  it('editor keeps deleted marker at added range end', () => {
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 5 },
          { type: 'deleted', from: 5, to: 5 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 5;
      }),
    ).toBe(true);
  });

  it('draft skips interior added marker inside deleted range', () => {
    const targets = getDiffPaintTargets({
      theme: 'draft',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 1, to: 5 },
          { type: 'added', from: 3, to: 3 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 3;
      }),
    ).toBe(false);
  });

  it('draft keeps added marker at deleted range start', () => {
    const targets = getDiffPaintTargets({
      theme: 'draft',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 1, to: 5 },
          { type: 'added', from: 1, to: 1 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 1;
      }),
    ).toBe(true);
  });

  it('draft keeps added marker at deleted range end', () => {
    const targets = getDiffPaintTargets({
      theme: 'draft',
      text: 'abcdef',
      docLineCount: 1,
      activeLineNumber: 1,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 1, to: 5 },
          { type: 'added', from: 5, to: 5 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 5;
      }),
    ).toBe(true);
  });
});

describe('getDiffPaintEffectValue', () => {
  it('includes lowest edited line', () => {
    expect(
      getDiffPaintEffectValue({
        editorHighlightRanges: [],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        fontStyleRanges: [],
        lowestEditedLine: { lineNumber: 8 },
      }),
    ).toEqual({
      editorHighlightRanges: [],
      draftHighlightRanges: [],
      editorLineDecorations: [],
      draftLineDecorations: [],
      lowestEditedLine: { lineNumber: 8 },
    });
  });
});

describe('getLinePaintGeometryAdjustment', () => {
  it('keeps fullLine offsets with reserved left gutter', () => {
    const adjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'fullLine',
      lineNumberLayout: 'reservedLeftGutter',
    });

    expect(adjustment.leftOffsetPx).toBe(DIFF_FULL_LINE_LEFT_OFFSET_PX);
    expect(adjustment.rightOffsetPx).toBe(DIFF_FULL_LINE_RIGHT_OFFSET_PX);
  });

  it('zeros full-line horizontal offsets when no left gutter is reserved', () => {
    const fullLine = getLinePaintGeometryAdjustment({
      geometryRole: 'fullLine',
      lineNumberLayout: 'noReservedLeftGutter',
    });
    const activeLine = getLinePaintGeometryAdjustment({
      geometryRole: 'activeLine',
      lineNumberLayout: 'noReservedLeftGutter',
    });
    const lowestEditedLine = getLinePaintGeometryAdjustment({
      geometryRole: 'lowestEditedLine',
      lineNumberLayout: 'noReservedLeftGutter',
    });

    expect(fullLine.leftOffsetPx).toBe(0);
    expect(fullLine.rightOffsetPx).toBe(0);
    expect(activeLine.leftOffsetPx).toBe(0);
    expect(activeLine.rightOffsetPx).toBe(0);
    expect(lowestEditedLine.leftOffsetPx).toBe(0);
    expect(lowestEditedLine.rightOffsetPx).toBe(0);
  });

  it('does not change inlineText horizontal offsets', () => {
    const adjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'inlineText',
      lineNumberLayout: 'noReservedLeftGutter',
    });

    expect(adjustment.leftOffsetPx).toBe(DIFF_PAINT_GEOMETRY.inlineText.leftOffsetPx);
    expect(adjustment.rightOffsetPx).toBe(DIFF_PAINT_GEOMETRY.inlineText.rightOffsetPx);
  });
});

describe('getVisualLineBox', () => {
  it('snaps a short rectangle to a single-line block', () => {
    expect(
      getVisualLineBox({
        rectTop: 12,
        rectHeight: 10,
        blockTop: 8,
        blockHeight: 24,
        lineHeight: 24,
      }),
    ).toEqual({ top: 8, height: 24 });
  });

  it('snaps rectangle to second row in multi-row block', () => {
    expect(
      getVisualLineBox({
        rectTop: 36,
        rectHeight: 8,
        blockTop: 8,
        blockHeight: 72,
        lineHeight: 24,
      }),
    ).toEqual({ top: 32, height: 24 });
  });

  it('clamps near bottom to last row', () => {
    expect(
      getVisualLineBox({
        rectTop: 78,
        rectHeight: 4,
        blockTop: 8,
        blockHeight: 72,
        lineHeight: 24,
      }),
    ).toEqual({ top: 56, height: 24 });
  });

  it('returns null for invalid inputs', () => {
    expect(
      getVisualLineBox({
        rectTop: Number.NaN,
        rectHeight: 8,
        blockTop: 8,
        blockHeight: 72,
        lineHeight: 24,
      }),
    ).toBeNull();
    expect(
      getVisualLineBox({
        rectTop: 10,
        rectHeight: 8,
        blockTop: 8,
        blockHeight: 72,
        lineHeight: 0,
      }),
    ).toBeNull();
  });
});

describe('getLineBoundedRangeSegments', () => {
  it('returns same range for a single-line segment', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abcdef',
        from: 1,
        to: 5,
      }),
    ).toEqual([{ from: 1, to: 5 }]);
  });

  it('splits a range crossing one newline into two text segments', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abc\ndef',
        from: 1,
        to: 6,
      }),
    ).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 6 },
    ]);
  });

  it('excludes newline-only ranges', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abc\ndef',
        from: 3,
        to: 4,
      }),
    ).toEqual([]);
  });

  it('skips empty lines in ranges crossing blank lines', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abc\n\ndef',
        from: 2,
        to: 7,
      }),
    ).toEqual([
      { from: 2, to: 3 },
      { from: 5, to: 7 },
    ]);
  });

  it('preserves spaces inside line segments', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'ab  \n  cd',
        from: 1,
        to: 8,
      }),
    ).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: 8 },
    ]);
  });

  it('supports CRLF line endings', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abc\r\ndef',
        from: 1,
        to: 7,
      }),
    ).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 7 },
    ]);
  });

  it('returns empty array for invalid ranges', () => {
    expect(
      getLineBoundedRangeSegments({
        text: 'abc',
        from: Number.NaN,
        to: 2,
      }),
    ).toEqual([]);
    expect(
      getLineBoundedRangeSegments({
        text: 'abc',
        from: -1,
        to: 2,
      }),
    ).toEqual([]);
    expect(
      getLineBoundedRangeSegments({
        text: 'abc',
        from: 2,
        to: 2,
      }),
    ).toEqual([]);
    expect(
      getLineBoundedRangeSegments({
        text: 'abc',
        from: 1,
        to: 4,
      }),
    ).toEqual([]);
  });
});

describe('getVisualRowRangeSegments', () => {
  const getPositionTop = (position: number, side: -1 | 1) => {
    const effectivePosition = side === -1 ? Math.max(0, position - 1) : position;

    if (effectivePosition < 7) {
      return 0;
    }
    if (effectivePosition < 14) {
      return 24;
    }

    return 48;
  };

  it('returns one segment when all positions are on same row', () => {
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 6,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([{ from: 0, to: 6 }]);
  });

  it('splits at one wrap boundary', () => {
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 12,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([
      { from: 0, to: 7 },
      { from: 7, to: 12 },
    ]);
  });

  it('splits when starting in middle of first row', () => {
    expect(
      getVisualRowRangeSegments({
        from: 3,
        to: 10,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([
      { from: 3, to: 7 },
      { from: 7, to: 10 },
    ]);
  });

  it('splits across multiple wrap boundaries', () => {
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 18,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([
      { from: 0, to: 7 },
      { from: 7, to: 14 },
      { from: 14, to: 18 },
    ]);
  });

  it('returns empty array for invalid ranges', () => {
    expect(
      getVisualRowRangeSegments({
        from: Number.NaN,
        to: 5,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([]);
    expect(
      getVisualRowRangeSegments({
        from: -1,
        to: 5,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([]);
    expect(
      getVisualRowRangeSegments({
        from: 3,
        to: 3,
        lineHeight: 24,
        getPositionTop,
      }),
    ).toEqual([]);
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 6,
        lineHeight: 0,
        getPositionTop,
      }),
    ).toEqual([]);
  });

  it('returns empty array when row lookup returns null and no safe split can be made', () => {
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 10,
        lineHeight: 24,
        getPositionTop: () => null,
      }),
    ).toEqual([]);
  });

  it('treats nearby top values within tolerance as same row', () => {
    expect(
      getVisualRowRangeSegments({
        from: 0,
        to: 8,
        lineHeight: 24,
        getPositionTop(position, side) {
          const effectivePosition = side === -1 ? Math.max(0, position - 1) : position;
          return effectivePosition < 7 ? 0 : 5;
        },
      }),
    ).toEqual([{ from: 0, to: 8 }]);
  });
});

describe('marker interior filtering helpers', () => {
  const range = {
    type: 'range' as const,
    className: 'byline-diff-added' as const,
    from: 1,
    to: 5,
    geometryRole: 'inlineText' as const,
  };

  const makeMarker = (position: number) => {
    return {
      type: 'marker' as const,
      className: 'byline-diff-deleted' as const,
      from: position,
      to: position + 1,
      side: 'left' as const,
      position,
      geometryRole: 'tick' as const,
    };
  };

  it('detects strict interior marker positions', () => {
    expect(isMarkerInsideInlineRange({ marker: makeMarker(3), range })).toBe(true);
  });

  it('does not treat start boundary as interior', () => {
    expect(isMarkerInsideInlineRange({ marker: makeMarker(1), range })).toBe(false);
  });

  it('does not treat end boundary as interior', () => {
    expect(isMarkerInsideInlineRange({ marker: makeMarker(5), range })).toBe(false);
  });

  it('filters only interior markers', () => {
    const markers = [makeMarker(0), makeMarker(1), makeMarker(3), makeMarker(5), makeMarker(6)];
    expect(
      getMarkerTargetsOutsideInlineRangeInteriors({
        markers,
        ranges: [range],
      }).map((marker) => marker.position),
    ).toEqual([0, 1, 5, 6]);
  });
});

describe('getNonWidgetTextBlocks', () => {
  it('filters out widget blocks and keeps text blocks', () => {
    const blocks = [
      { top: 8, height: 24, widget: null },
      { top: 32, height: 24, widget: { type: 'widget' } },
      { top: 56, height: 24, widget: null },
    ];

    expect(getNonWidgetTextBlocks(blocks)).toEqual([
      { top: 8, height: 24, widget: null },
      { top: 56, height: 24, widget: null },
    ]);
  });
});

describe('getAdjustedPaintRectBox', () => {
  it('vertical offset shifts down while keeping height', () => {
    expect(
      getAdjustedPaintRectBox(
        { left: 10, top: 20, width: 30, height: 40 },
        { topOffsetPx: 8, bottomOffsetPx: 8, leftOffsetPx: 0, rightOffsetPx: 0 },
      ),
    ).toEqual({ left: 10, top: 28, width: 30, height: 40 });
  });

  it('horizontal offsets shift left and adjust width', () => {
    expect(
      getAdjustedPaintRectBox(
        { left: 0, top: 20, width: 100, height: 40 },
        { topOffsetPx: 0, bottomOffsetPx: 0, leftOffsetPx: 64, rightOffsetPx: 40 },
      ),
    ).toEqual({ left: 64, top: 20, width: 76, height: 40 });
  });

  it('tick geometry width is 3px', () => {
    expect(DIFF_PAINT_GEOMETRY.tick.widthPx).toBe(3);
  });

  it('returns null for non-positive adjusted dimensions', () => {
    expect(
      getAdjustedPaintRectBox(
        { left: 10, top: 20, width: 1, height: 40 },
        { topOffsetPx: 0, bottomOffsetPx: 0, leftOffsetPx: 1, rightOffsetPx: -1 },
      ),
    ).toBeNull();
    expect(
      getAdjustedPaintRectBox(
        { left: 10, top: 20, width: 30, height: 1 },
        { topOffsetPx: 1, bottomOffsetPx: -1, leftOffsetPx: 0, rightOffsetPx: 0 },
      ),
    ).toBeNull();
  });
});

describe('lowest edited line geometry', () => {
  it('uses same offsets as full line geometry', () => {
    expect(DIFF_PAINT_GEOMETRY.lowestEditedLine).toEqual(DIFF_PAINT_GEOMETRY.fullLine);
  });

  it('uses 1px rule height', () => {
    expect(LOWEST_EDITED_LINE_HEIGHT_PX).toBe(1);
  });

  it('builds bottom-edge rule box from adjusted line box', () => {
    expect(
      getLowestEditedLineRuleBox({
        left: 0,
        top: 20,
        width: 100,
        height: 24,
      }),
    ).toEqual({
      left: 64,
      top: 51,
      width: 76,
      height: 1,
    });
  });

  it('returns null when adjusted box is invalid', () => {
    expect(
      getLowestEditedLineRuleBox({
        left: 0,
        top: 20,
        width: 10,
        height: 24,
      }),
    ).toBeNull();
  });
});
