import { ChangeSet, EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

import type { DraftHighlightRange, DraftLineDecoration, EditorHighlightRange } from '../editorDiff';
import {
  getActiveLineDiffPaintTargets,
  TYPING_DIFF_ADDED_CLASS_NAME,
  TYPING_DIFF_DELETED_CLASS_NAME,
  diffPaintField,
  getDiffPaintEffectValue,
  getMappedDiffPaintStateThroughChanges,
  getTypingDiffDecorations,
  getDiffPaintTargets,
  getLineBoundedRangeSegments,
  getMarkerTargetsOutsideInlineRangeInteriors,
  getNonWidgetTextBlocks,
  getVisibleDiffPaintTargets,
  isMarkerInsideInlineRange,
  mapDiffPaintStateThroughChanges,
  setDiffPaintEffect,
  setDiffPaintTypingEffect,
  setTypingDiffDecorationsEffect,
  typingDiffDecorationsField,
  getVisualRowRangeSegments,
  getVisualLineBox,
  type DiffPaintState,
} from './codeMirrorDiffPaint';
import {
  DIFF_CONTENT_HORIZONTAL_PADDING_PX,
  DIFF_PAINT_GEOMETRY,
  DIFF_FULL_LINE_RIGHT_OFFSET_PX,
  getAdjustedPaintRectBox,
  getLinePaintGeometryAdjustment,
  getLowestEditedLineRuleBox,
  LOWEST_EDITED_LINE_HEIGHT_PX,
} from './codeMirrorDiffPaintGeometry';
import {
  FULL_LINE_HIGHLIGHT_NO_LEFT_GUTTER_NUDGE_PX,
  FULL_LINE_HIGHLIGHT_RESERVED_LEFT_GUTTER_NUDGE_PX,
  FULL_LINE_HIGHLIGHT_RIGHT_NUDGE_PX,
} from '../layoutTuning';

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
    isTyping: false,
  };

  return getDiffPaintTargets({
    theme,
    text: BASE_TEXT,
    docLineCount: 3,
    activeLineNumber: 2,
    diffPaint,
  });
};

const getDecorationRanges = (
  value: ReturnType<typeof getTypingDiffDecorations> | DecorationSet,
): Array<{ from: number; to: number; className: string | undefined }> => {
  const set = 'decorations' in value ? value.decorations : value;
  const ranges: Array<{ from: number; to: number; className: string | undefined }> = [];
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to, rangeValue) => {
    const className =
      typeof rangeValue.spec.class === 'string'
        ? rangeValue.spec.class
        : undefined;
    if (!className) {
      return;
    }
    ranges.push({ from, to, className });
  });
  return ranges;
};

const getWidgetDecorationPositions = (
  value: ReturnType<typeof getTypingDiffDecorations>,
): Array<{ position: number; className: 'byline-diff-added' | 'byline-diff-deleted' }> => {
  return value.tickMarkers;
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
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
      isTyping: false,
      },
    });

    expect(
      targets.some((target) => {
        return target.type === 'marker' && target.position === 5;
      }),
    ).toBe(true);
  });
});

describe('getActiveLineDiffPaintTargets', () => {
  it('returns exactly one active-line target', () => {
    expect(getActiveLineDiffPaintTargets(7)).toEqual([
      {
        type: 'line',
        className: 'byline-diff-active-line',
        lineNumber: 7,
        geometryRole: 'activeLine',
      },
    ]);
  });
});

describe('typing diff class names', () => {
  it('exports stable class names', () => {
    expect(TYPING_DIFF_ADDED_CLASS_NAME).toBe(
      'byline-typing-diff byline-typing-diff-added',
    );
    expect(TYPING_DIFF_DELETED_CLASS_NAME).toBe(
      'byline-typing-diff byline-typing-diff-deleted',
    );
  });
});

describe('getTypingDiffDecorations', () => {
  it('editor includes non-zero added ranges', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 20,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 2, to: 6 },
          { type: 'deleted', from: 8, to: 8 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([
      { from: 2, to: 6, className: TYPING_DIFF_ADDED_CLASS_NAME },
    ]);
  });

  it('draft includes non-zero deleted ranges and skips added markers', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'draft',
      docLength: 20,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 3, to: 7 },
          { type: 'added', from: 8, to: 8 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([
      { from: 3, to: 7, className: TYPING_DIFF_DELETED_CLASS_NAME },
    ]);
  });

  it('clamps out-of-bounds ranges and drops invalid ranges', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: -4, to: 3 },
          { type: 'added', from: 8, to: 99 },
          { type: 'added', from: 6, to: 6 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([
      { from: 0, to: 3, className: TYPING_DIFF_ADDED_CLASS_NAME },
      { from: 8, to: 10, className: TYPING_DIFF_ADDED_CLASS_NAME },
    ]);
  });

  it('editor zero-width deleted ranges become tick widgets', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [{ type: 'deleted', from: 4, to: 4 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(decorations)).toEqual([
      { position: 4, className: 'byline-diff-deleted' },
    ]);
  });

  it('draft zero-width added ranges become tick widgets', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'draft',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [{ type: 'added', from: 6, to: 6 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(decorations)).toEqual([
      { position: 6, className: 'byline-diff-added' },
    ]);
  });

  it('editor zero-width added ranges are skipped', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [{ type: 'added', from: 5, to: 5 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([]);
    expect(getWidgetDecorationPositions(decorations)).toEqual([]);
  });

  it('draft zero-width deleted ranges are skipped', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'draft',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [{ type: 'deleted', from: 2, to: 2 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([]);
    expect(getWidgetDecorationPositions(decorations)).toEqual([]);
  });

  it('skips out-of-bounds zero-width positions', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [{ type: 'deleted', from: 11, to: 11 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(decorations)).toEqual([]);
  });

  it('keeps non-zero ranges and zero-width ticks together', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 3 },
          { type: 'deleted', from: 4, to: 4 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([
      { from: 1, to: 3, className: TYPING_DIFF_ADDED_CLASS_NAME },
    ]);
    expect(getWidgetDecorationPositions(decorations)).toEqual([
      { position: 4, className: 'byline-diff-deleted' },
    ]);
  });

  it('editor skips deleted tick inside an added inline range', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 6 },
          { type: 'deleted', from: 3, to: 3 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getDecorationRanges(decorations)).toEqual([
      { from: 1, to: 6, className: TYPING_DIFF_ADDED_CLASS_NAME },
    ]);
    expect(getWidgetDecorationPositions(decorations)).toEqual([]);
  });

  it('editor keeps deleted tick at added range boundaries', () => {
    const startBoundary = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 6 },
          { type: 'deleted', from: 1, to: 1 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });
    const endBoundary = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 6 },
          { type: 'deleted', from: 6, to: 6 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(startBoundary)).toEqual([
      { position: 1, className: 'byline-diff-deleted' },
    ]);
    expect(getWidgetDecorationPositions(endBoundary)).toEqual([
      { position: 6, className: 'byline-diff-deleted' },
    ]);
  });

  it('editor skips deleted tick between adjacent added ranges after merge', () => {
    const decorations = getTypingDiffDecorations({
      theme: 'editor',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [
          { type: 'added', from: 1, to: 3 },
          { type: 'added', from: 3, to: 6 },
          { type: 'deleted', from: 3, to: 3 },
        ],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(decorations)).toEqual([]);
  });

  it('draft skips added tick inside a deleted inline range and keeps boundaries', () => {
    const interior = getTypingDiffDecorations({
      theme: 'draft',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 1, to: 6 },
          { type: 'added', from: 3, to: 3 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });
    const boundary = getTypingDiffDecorations({
      theme: 'draft',
      docLength: 10,
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [
          { type: 'deleted', from: 1, to: 6 },
          { type: 'added', from: 6, to: 6 },
        ],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
        isTyping: false,
      },
    });

    expect(getWidgetDecorationPositions(interior)).toEqual([]);
    expect(getWidgetDecorationPositions(boundary)).toEqual([
      { position: 6, className: 'byline-diff-added' },
    ]);
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
      isTyping: false,
    });
  });
});

describe('diffPaintField', () => {
  it('starts with isTyping false', () => {
    const state = EditorState.create({
      doc: 'one',
      extensions: [diffPaintField],
    });

    expect(state.field(diffPaintField)).toEqual({
      editorHighlightRanges: [],
      draftHighlightRanges: [],
      editorLineDecorations: [],
      draftLineDecorations: [],
      lowestEditedLine: null,
      isTyping: false,
    });
  });

  it('sets typing true on docChanged without remapping ranges', () => {
    const initialState = EditorState.create({
      doc: 'one',
      extensions: [diffPaintField],
    });

    const seededState = initialState.update({
      effects: [
        setDiffPaintEffect.of({
          editorHighlightRanges: [{ type: 'added', from: 0, to: 2 }],
          draftHighlightRanges: [{ type: 'deleted', from: 0, to: 1 }],
          editorLineDecorations: [{ lineNumber: 1 }],
          draftLineDecorations: [],
          lowestEditedLine: { lineNumber: 1 },
          isTyping: false,
        }),
      ],
    }).state;

    const afterDocChange = seededState.update({
      changes: { from: 1, insert: 'x' },
    }).state;

    expect(afterDocChange.field(diffPaintField)).toEqual({
      editorHighlightRanges: [{ type: 'added', from: 0, to: 2 }],
      draftHighlightRanges: [{ type: 'deleted', from: 0, to: 1 }],
      editorLineDecorations: [{ lineNumber: 1 }],
      draftLineDecorations: [],
      lowestEditedLine: { lineNumber: 1 },
      isTyping: true,
    });
  });

  it('keeps state unchanged across docChanged while already typing', () => {
    const initialState = EditorState.create({
      doc: 'one',
      extensions: [diffPaintField],
    });

    const seededState = initialState.update({
      effects: [setDiffPaintTypingEffect.of(true)],
    }).state;

    const nextState = seededState.update({
      changes: { from: 1, insert: 'x' },
    }).state;

    expect(nextState.field(diffPaintField)).toBe(seededState.field(diffPaintField));
  });

  it('applies setDiffPaintTypingEffect and setDiffPaintEffect semantics', () => {
    const initialState = EditorState.create({
      doc: 'one',
      extensions: [diffPaintField],
    });

    const typingState = initialState.update({
      effects: [setDiffPaintTypingEffect.of(true)],
    }).state;

    expect(typingState.field(diffPaintField).isTyping).toBe(true);

    const replacedState = typingState.update({
      effects: [
        setDiffPaintEffect.of({
          editorHighlightRanges: [{ type: 'deleted', from: 2, to: 2 }],
          draftHighlightRanges: [{ type: 'added', from: 2, to: 2 }],
          editorLineDecorations: [],
          draftLineDecorations: [],
          lowestEditedLine: null,
          isTyping: false,
        }),
      ],
    }).state;

    expect(replacedState.field(diffPaintField)).toEqual({
      editorHighlightRanges: [{ type: 'deleted', from: 2, to: 2 }],
      draftHighlightRanges: [{ type: 'added', from: 2, to: 2 }],
      editorLineDecorations: [],
      draftLineDecorations: [],
      lowestEditedLine: null,
      isTyping: false,
    });
  });
});

describe('typingDiffDecorationsField', () => {
  it('starts hidden while not typing', () => {
    const state = EditorState.create({
      doc: 'one',
      extensions: [typingDiffDecorationsField],
    });

    const fieldValue = state.field(typingDiffDecorationsField);
    expect(fieldValue.isTyping).toBe(false);
    expect(getDecorationRanges(fieldValue.decorations)).toEqual([]);
    expect(fieldValue.tickMarkers).toEqual([]);
  });

  it('stores decorations and shows them only while typing', () => {
    const state = EditorState.create({
      doc: 'abcdef',
      extensions: [typingDiffDecorationsField],
    });

    const seededDecorations = Decoration.set([
      Decoration.mark({ class: 'byline-diff-added' }).range(1, 3),
    ]);
    const seededState = state.update({
      effects: [
        setTypingDiffDecorationsEffect.of({
          decorations: seededDecorations,
          tickMarkers: [{ className: 'byline-diff-deleted', position: 4 }],
        }),
      ],
    }).state;

    expect(seededState.field(typingDiffDecorationsField).isTyping).toBe(false);
    expect(
      getDecorationRanges(seededState.field(typingDiffDecorationsField).decorations),
    ).toEqual([{ from: 1, to: 3, className: 'byline-diff-added' }]);
    expect(seededState.field(typingDiffDecorationsField).tickMarkers).toEqual([
      { className: 'byline-diff-deleted', position: 4 },
    ]);

    const typingState = seededState.update({
      effects: [setDiffPaintTypingEffect.of(true)],
    }).state;

    expect(typingState.field(typingDiffDecorationsField).isTyping).toBe(true);
  });

  it('maps stored decorations through doc changes while typing', () => {
    const state = EditorState.create({
      doc: 'abcdef',
      extensions: [typingDiffDecorationsField],
    });

    const seededDecorations = Decoration.set([
      Decoration.mark({ class: 'byline-diff-added' }).range(2, 4),
    ]);
    const seededState = state.update({
      effects: [
        setTypingDiffDecorationsEffect.of({
          decorations: seededDecorations,
          tickMarkers: [{ className: 'byline-diff-added', position: 3 }],
        }),
        setDiffPaintTypingEffect.of(true),
      ],
    }).state;

    const nextState = seededState.update({
      changes: { from: 0, insert: 'xx' },
    }).state;
    const fieldValue = nextState.field(typingDiffDecorationsField);

    expect(fieldValue.isTyping).toBe(true);
    expect(getDecorationRanges(fieldValue.decorations)).toEqual([
      { from: 4, to: 6, className: 'byline-diff-added' },
    ]);
    expect(fieldValue.tickMarkers).toEqual([
      { className: 'byline-diff-added', position: 5 },
    ]);
  });

  it('reset effect replaces decorations and clears typing', () => {
    const state = EditorState.create({
      doc: 'abcdef',
      extensions: [typingDiffDecorationsField],
    });

    const typingState = state.update({
      effects: [setDiffPaintTypingEffect.of(true)],
    }).state;
    const replacement = Decoration.set([
      Decoration.mark({ class: 'byline-diff-deleted' }).range(0, 2),
    ]);
    const replacedState = typingState.update({
      effects: [
        setTypingDiffDecorationsEffect.of({
          decorations: replacement,
          tickMarkers: [{ className: 'byline-diff-added', position: 1 }],
        }),
      ],
    }).state;

    const fieldValue = replacedState.field(typingDiffDecorationsField);
    expect(fieldValue.isTyping).toBe(false);
    expect(getDecorationRanges(fieldValue.decorations)).toEqual([
      { from: 0, to: 2, className: 'byline-diff-deleted' },
    ]);
    expect(fieldValue.tickMarkers).toEqual([
      { className: 'byline-diff-added', position: 1 },
    ]);
  });
});

describe('getMappedDiffPaintStateThroughChanges', () => {
  it('maps existing editor ranges through insertion', () => {
    const changes = ChangeSet.of([{ from: 0, insert: '123 ' }], 3);
    const next = getMappedDiffPaintStateThroughChanges({
      diffPaint: {
        editorHighlightRanges: [{ type: 'added', from: 2, to: 3 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    });

    expect(next.editorHighlightRanges).toEqual([{ type: 'added', from: 6, to: 7 }]);
  });

  it('maps existing draft deleted ranges through insertion', () => {
    const changes = ChangeSet.of([{ from: 0, insert: '123 ' }], 3);
    const next = getMappedDiffPaintStateThroughChanges({
      diffPaint: {
        editorHighlightRanges: [],
        draftHighlightRanges: [{ type: 'deleted', from: 2, to: 3 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    });

    expect(next.draftHighlightRanges).toEqual([{ type: 'deleted', from: 6, to: 7 }]);
  });

  it('maps zero-width markers without adding guessed inserted ranges', () => {
    const changes = ChangeSet.of([{ from: 2, insert: 'x' }], 4);
    const next = getMappedDiffPaintStateThroughChanges({
      diffPaint: {
        editorHighlightRanges: [{ type: 'deleted', from: 2, to: 2 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    });

    expect(next.editorHighlightRanges).toEqual([{ type: 'deleted', from: 3, to: 3 }]);
  });
});

describe('mapDiffPaintStateThroughChanges', () => {
  it('maps non-empty editor ranges forward after insert before range', () => {
    const changes = ChangeSet.of([{ from: 1, insert: 'x' }], 6);
    const next = mapDiffPaintStateThroughChanges(
      {
        editorHighlightRanges: [{ type: 'added', from: 2, to: 4 }],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    );

    expect(next.editorHighlightRanges).toEqual([{ type: 'added', from: 3, to: 5 }]);
  });

  it('maps non-empty draft ranges forward after insert before range', () => {
    const changes = ChangeSet.of([{ from: 0, insert: 'zz' }], 6);
    const next = mapDiffPaintStateThroughChanges(
      {
        editorHighlightRanges: [],
        draftHighlightRanges: [{ type: 'deleted', from: 2, to: 4 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    );

    expect(next.draftHighlightRanges).toEqual([{ type: 'deleted', from: 4, to: 6 }]);
  });

  it('maps zero-width marker ranges', () => {
    const changes = ChangeSet.of([{ from: 2, insert: 'x' }], 6);
    const next = mapDiffPaintStateThroughChanges(
      {
        editorHighlightRanges: [{ type: 'deleted', from: 2, to: 2 }],
        draftHighlightRanges: [{ type: 'added', from: 2, to: 2 }],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      isTyping: false,
      },
      changes,
    );

    expect(next.editorHighlightRanges).toEqual([{ type: 'deleted', from: 3, to: 3 }]);
    expect(next.draftHighlightRanges).toEqual([{ type: 'added', from: 3, to: 3 }]);
  });

  it('keeps line decorations and lowest edited line unchanged', () => {
    const changes = ChangeSet.of([{ from: 0, insert: 'x' }], 4);
    const next = mapDiffPaintStateThroughChanges(
      {
        editorHighlightRanges: [],
        draftHighlightRanges: [],
        editorLineDecorations: [{ lineNumber: 2 }],
        draftLineDecorations: [
          { type: 'deletedDraftLine', lineNumber: 3, placement: 'before' },
        ],
        lowestEditedLine: { lineNumber: 5 },
      isTyping: false,
      },
      changes,
    );

    expect(next.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(next.draftLineDecorations).toEqual([
      { type: 'deletedDraftLine', lineNumber: 3, placement: 'before' },
    ]);
    expect(next.lowestEditedLine).toEqual({ lineNumber: 5 });
  });
});

describe('getVisibleDiffPaintTargets', () => {
  const lineRangeByLineNumber = {
    1: { from: 0, to: 3 },
    2: { from: 4, to: 7 },
    3: { from: 8, to: 12 },
  } as const;

  const getLineRange = (lineNumber: number) => {
    return lineRangeByLineNumber[lineNumber as 1 | 2 | 3] ?? null;
  };

  it('includes range targets overlapping visible ranges', () => {
    const targets = getVisibleDiffPaintTargets({
      targets: [
        {
          type: 'range',
          className: 'byline-diff-added',
          from: 5,
          to: 6,
          geometryRole: 'inlineText',
        },
      ],
      visibleRanges: [{ from: 4, to: 8 }],
      docLineCount: 3,
      getLineRange,
    });

    expect(targets).toHaveLength(1);
  });

  it('excludes range targets far outside visible ranges', () => {
    const targets = getVisibleDiffPaintTargets({
      targets: [
        {
          type: 'range',
          className: 'byline-diff-added',
          from: 10000,
          to: 10010,
          geometryRole: 'inlineText',
        },
      ],
      visibleRanges: [{ from: 4, to: 8 }],
      docLineCount: 3,
      getLineRange,
    });

    expect(targets).toEqual([]);
  });

  it('includes marker targets overlapping visible ranges', () => {
    const targets = getVisibleDiffPaintTargets({
      targets: [
        {
          type: 'marker',
          className: 'byline-diff-deleted',
          from: 4,
          to: 5,
          side: 'left',
          position: 4,
          geometryRole: 'tick',
        },
      ],
      visibleRanges: [{ from: 2, to: 6 }],
      docLineCount: 3,
      getLineRange,
    });

    expect(targets).toHaveLength(1);
  });

  it('includes line targets whose line range overlaps visible ranges', () => {
    const targets = getVisibleDiffPaintTargets({
      targets: [
        {
          type: 'line',
          className: 'byline-diff-active-line',
          lineNumber: 2,
          geometryRole: 'activeLine',
        },
      ],
      visibleRanges: [{ from: 4, to: 8 }],
      docLineCount: 3,
      getLineRange,
    });

    expect(targets).toHaveLength(1);
  });

  it('excludes line targets outside visible ranges', () => {
    const targets = getVisibleDiffPaintTargets({
      targets: [
        {
          type: 'line',
          className: 'byline-diff-active-line',
          lineNumber: 3,
          geometryRole: 'activeLine',
        },
      ],
      visibleRanges: [{ from: 0, to: 2 }],
      docLineCount: 3,
      getLineRange: () => ({ from: 2000, to: 2005 }),
    });

    expect(targets).toEqual([]);
  });
});

describe('getLinePaintGeometryAdjustment', () => {
  it('uses provided reserved left gutter width for line-wide paint', () => {
    const adjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'fullLine',
      lineNumberLayout: 'reservedLeftGutter',
      reservedLeftGutterWidthPx: 73,
    });

    expect(adjustment.leftOffsetPx).toBe(
      73 + FULL_LINE_HIGHLIGHT_RESERVED_LEFT_GUTTER_NUDGE_PX,
    );
    expect(adjustment.rightOffsetPx).toBe(
      DIFF_FULL_LINE_RIGHT_OFFSET_PX + FULL_LINE_HIGHLIGHT_RIGHT_NUDGE_PX,
    );
  });

  it('uses content padding offsets for line-wide paint when no left gutter is reserved', () => {
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

    expect(fullLine.leftOffsetPx).toBe(
      DIFF_CONTENT_HORIZONTAL_PADDING_PX +
      FULL_LINE_HIGHLIGHT_NO_LEFT_GUTTER_NUDGE_PX,
    );
    expect(fullLine.rightOffsetPx).toBe(
      -DIFF_CONTENT_HORIZONTAL_PADDING_PX + FULL_LINE_HIGHLIGHT_RIGHT_NUDGE_PX,
    );
    expect(activeLine.leftOffsetPx).toBe(
      DIFF_CONTENT_HORIZONTAL_PADDING_PX +
      FULL_LINE_HIGHLIGHT_NO_LEFT_GUTTER_NUDGE_PX,
    );
    expect(activeLine.rightOffsetPx).toBe(
      -DIFF_CONTENT_HORIZONTAL_PADDING_PX + FULL_LINE_HIGHLIGHT_RIGHT_NUDGE_PX,
    );
    expect(lowestEditedLine.leftOffsetPx).toBe(
      DIFF_CONTENT_HORIZONTAL_PADDING_PX +
      FULL_LINE_HIGHLIGHT_NO_LEFT_GUTTER_NUDGE_PX,
    );
    expect(lowestEditedLine.rightOffsetPx).toBe(
      -DIFF_CONTENT_HORIZONTAL_PADDING_PX + FULL_LINE_HIGHLIGHT_RIGHT_NUDGE_PX,
    );
  });

  it('does not change inlineText horizontal offsets', () => {
    const inlineAdjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'inlineText',
      lineNumberLayout: 'noReservedLeftGutter',
    });
    const tickAdjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'tick',
      lineNumberLayout: 'noReservedLeftGutter',
    });
    const missingLineAdjustment = getLinePaintGeometryAdjustment({
      geometryRole: 'missingLine',
      lineNumberLayout: 'noReservedLeftGutter',
    });

    expect(inlineAdjustment.leftOffsetPx).toBe(DIFF_PAINT_GEOMETRY.inlineText.leftOffsetPx);
    expect(inlineAdjustment.rightOffsetPx).toBe(DIFF_PAINT_GEOMETRY.inlineText.rightOffsetPx);
    expect(tickAdjustment.leftOffsetPx).toBe(DIFF_PAINT_GEOMETRY.tick.leftOffsetPx);
    expect(tickAdjustment.rightOffsetPx).toBe(DIFF_PAINT_GEOMETRY.tick.rightOffsetPx);
    expect(missingLineAdjustment.leftOffsetPx).toBe(DIFF_PAINT_GEOMETRY.missingLine.leftOffsetPx);
    expect(missingLineAdjustment.rightOffsetPx).toBe(DIFF_PAINT_GEOMETRY.missingLine.rightOffsetPx);
  });

  it('uses 12px as the content horizontal padding constant', () => {
    expect(DIFF_CONTENT_HORIZONTAL_PADDING_PX).toBe(12);
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
