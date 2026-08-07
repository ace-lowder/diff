import {
  type ChangeSet,
  EditorSelection,
  StateEffect,
  StateField,
  type Text,
  type ChangeDesc,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  RectangleMarker,
  layer,
  type LayerMarker,
} from '@codemirror/view';

import type { CodeMirrorTheme } from '../appTypes';
import type {
  DraftHighlightRange,
  DraftLineDecoration,
  EditorHighlightRange,
  EditorLineDecoration,
  LowestEditedLine,
} from '../editorDiff';
import type { CodeMirrorDecorations } from './codeMirrorDecorations';
import {
  DIFF_CONTENT_HORIZONTAL_PADDING_PX,
  DIFF_PAINT_GEOMETRY,
  DIFF_TICK_WIDTH_PX,
  getAdjustedPaintRectBox,
  getLinePaintGeometryAdjustment,
  getLowestEditedLineRuleBox,
  type DiffPaintLineNumberLayout,
  type DiffPaintGeometryRole,
  type PaintRectBox,
} from './codeMirrorDiffPaintGeometry';
import {
  getVisibleLineNumberGutterWidthPx,
  lineNumberSettingsField,
  shouldShowLineNumberGutter,
} from './codeMirrorLineCopy';
import { getMarkerRange, type MarkerSide } from './markerRanges';

export type DiffPaintClassName =
  | 'diff-diff-added'
  | 'diff-diff-deleted'
  | 'diff-diff-active-line';

export const TYPING_DIFF_ADDED_CLASS_NAME =
  'diff-typing-diff diff-typing-diff-added';
export const TYPING_DIFF_DELETED_CLASS_NAME =
  'diff-typing-diff diff-typing-diff-deleted';

export type DiffPaintTarget =
  | {
      type: 'range';
      className: 'diff-diff-added' | 'diff-diff-deleted';
      from: number;
      to: number;
      geometryRole: DiffPaintGeometryRole;
    }
  | {
      type: 'marker';
      className: 'diff-diff-added' | 'diff-diff-deleted';
      from: number;
      to: number;
      side: MarkerSide;
      position: number;
      geometryRole: DiffPaintGeometryRole;
    }
  | {
      type: 'line';
      className: DiffPaintClassName;
      lineNumber: number;
      geometryRole: DiffPaintGeometryRole;
    };

export type DiffPaintState = {
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
  lowestEditedLine: LowestEditedLine | null;
  isTyping: boolean;
};

type TypingDiffDecorationsState = {
  decorations: DecorationSet;
  tickMarkers: TypingDiffTickMarker[];
  isTyping: boolean;
};

type TypingDiffTickMarker = {
  position: number;
  className: 'diff-diff-added' | 'diff-diff-deleted';
};

type TypingDiffDecorationsValue = {
  decorations: DecorationSet;
  tickMarkers: TypingDiffTickMarker[];
};

export type VisualLineBoxInput = {
  rectTop: number;
  rectHeight: number;
  blockTop: number;
  blockHeight: number;
  lineHeight: number;
};

export type VisualLineBox = {
  top: number;
  height: number;
};

export type VisibleTextRange = {
  from: number;
  to: number;
};

type PaintBlock = {
  top: number;
  height: number;
  widget: unknown | null;
};

type TypingInlineRange = {
  from: number;
  to: number;
};

const VISIBLE_RANGE_BUFFER_CHARS = 500;

export const setDiffPaintEffect = StateEffect.define<DiffPaintState>();
export const setDiffPaintTypingEffect = StateEffect.define<boolean>();
export const setTypingDiffDecorationsEffect =
  StateEffect.define<TypingDiffDecorationsValue>();

export const diffPaintField = StateField.define<DiffPaintState>({
  create() {
    return {
      editorHighlightRanges: [],
      draftHighlightRanges: [],
      editorLineDecorations: [],
      draftLineDecorations: [],
      lowestEditedLine: null,
      isTyping: false,
    };
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiffPaintEffect)) {
        return { ...effect.value, isTyping: false };
      }

      if (effect.is(setDiffPaintTypingEffect)) {
        if (value.isTyping === effect.value) {
          return value;
        }

        return { ...value, isTyping: effect.value };
      }
    }

    if (transaction.docChanged) {
      if (value.isTyping) {
        return value;
      }

      return { ...value, isTyping: true };
    }

    return value;
  },
});

export const typingDiffDecorationsField = StateField.define<TypingDiffDecorationsState>(
  {
    create() {
      return {
        decorations: Decoration.none,
        tickMarkers: [],
        isTyping: false,
      };
    },
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setTypingDiffDecorationsEffect)) {
          return {
            decorations: effect.value.decorations,
            tickMarkers: effect.value.tickMarkers,
            isTyping: false,
          };
        }

        if (effect.is(setDiffPaintTypingEffect)) {
          if (value.isTyping === effect.value) {
            return value;
          }

          return {
            decorations: value.decorations,
            tickMarkers: value.tickMarkers,
            isTyping: effect.value,
          };
        }
      }

      if (transaction.docChanged) {
        return {
          decorations: value.decorations.map(transaction.changes),
          tickMarkers: value.tickMarkers
            .map((marker) => {
              return {
                ...marker,
                position: transaction.changes.mapPos(marker.position, 1),
              };
            })
            .filter((marker) => {
              return (
                marker.position >= 0 &&
                marker.position <= transaction.newDoc.length
              );
            }),
          isTyping: true,
        };
      }

      return value;
    },
    provide(field) {
      return EditorView.decorations.from(field, (value) => {
        return value.isTyping ? value.decorations : Decoration.none;
      });
    },
  },
);

export const mapDiffPaintStateThroughChanges = (
  diffPaint: DiffPaintState,
  changes: ChangeDesc,
): DiffPaintState => {
  return {
    editorHighlightRanges: diffPaint.editorHighlightRanges
      .map((range) => mapHighlightRangeThroughChanges(range, changes))
      .filter((range): range is EditorHighlightRange => range !== null),
    draftHighlightRanges: diffPaint.draftHighlightRanges
      .map((range) => mapHighlightRangeThroughChanges(range, changes))
      .filter((range): range is DraftHighlightRange => range !== null),
    editorLineDecorations: diffPaint.editorLineDecorations,
    draftLineDecorations: diffPaint.draftLineDecorations,
    lowestEditedLine: diffPaint.lowestEditedLine,
    isTyping: diffPaint.isTyping,
  };
};

export const getMappedDiffPaintStateThroughChanges = ({
  diffPaint,
  changes,
}: {
  diffPaint: DiffPaintState;
  changes: ChangeSet;
}): DiffPaintState => {
  return mapDiffPaintStateThroughChanges(diffPaint, changes);
};

export const getDiffPaintEffectValue = (
  decorations: CodeMirrorDecorations,
): DiffPaintState => {
  return {
    editorHighlightRanges: decorations.editorHighlightRanges,
    draftHighlightRanges: decorations.draftHighlightRanges,
    editorLineDecorations: decorations.editorLineDecorations,
    draftLineDecorations: decorations.draftLineDecorations,
    lowestEditedLine: decorations.lowestEditedLine,
    isTyping: false,
  };
};

export const getDiffPaintTargets = ({
  theme,
  text,
  docLineCount,
  activeLineNumber,
  diffPaint,
}: {
  theme: CodeMirrorTheme;
  text: string;
  docLineCount: number;
  activeLineNumber: number;
  diffPaint: DiffPaintState;
}): DiffPaintTarget[] => {
  const docLength = text.length;
  const targets: DiffPaintTarget[] = [];

  targets.push(...getActiveLineDiffPaintTargets(activeLineNumber));

  if (theme === 'editor') {
    targets.push(
      ...getEditorRangeTargets(diffPaint.editorHighlightRanges, docLength, text),
      ...getEditorLineTargets(diffPaint.editorLineDecorations, docLineCount),
    );

    return targets;
  }

  targets.push(
    ...getDraftRangeTargets(diffPaint.draftHighlightRanges, docLength, text),
    ...getDraftLineTargets(diffPaint.draftLineDecorations, docLineCount),
  );

  return targets;
};

export const getActiveLineDiffPaintTargets = (
  activeLineNumber: number,
): Array<Extract<DiffPaintTarget, { type: 'line' }>> => {
  return [
    {
      type: 'line',
      className: 'diff-diff-active-line',
      lineNumber: activeLineNumber,
      geometryRole: 'activeLine',
    },
  ];
};

export const getTypingDiffDecorations = ({
  theme,
  docLength,
  diffPaint,
}: {
  theme: CodeMirrorTheme;
  docLength: number;
  diffPaint: DiffPaintState;
}): TypingDiffDecorationsValue => {
  if (docLength < 0) {
    return {
      decorations: Decoration.none,
      tickMarkers: [],
    };
  }
  const typingDecorations =
    theme === 'editor'
      ? getEditorTypingDecorations({
          ranges: diffPaint.editorHighlightRanges,
          docLength,
        })
      : getDraftTypingDecorations({
          ranges: diffPaint.draftHighlightRanges,
          docLength,
        });
  return {
    decorations:
      typingDecorations.marks.length === 0
        ? Decoration.none
        : Decoration.set(typingDecorations.marks, true),
    tickMarkers: typingDecorations.tickMarkers,
  };
};

export const getCodeMirrorDiffPaintExtension = (
  theme: CodeMirrorTheme,
): Extension[] => {
  return [
    diffPaintField,
    typingDiffDecorationsField,
    layer({
      above: false,
      class: 'diff-diff-layer',
      update(update) {
        return (
          update.selectionSet ||
          update.viewportChanged ||
          update.geometryChanged ||
          update.startState.field(diffPaintField) !== update.state.field(diffPaintField)
        );
      },
      markers(view) {
        return getDiffPaintMarkers(view, theme);
      },
    }),
    layer({
      above: true,
      class: 'diff-diff-rule-layer',
      update(update) {
        return (
          update.viewportChanged ||
          update.geometryChanged ||
          update.startState.field(diffPaintField) !== update.state.field(diffPaintField)
        );
      },
      markers(view) {
        return getLowestEditedLineMarkers(view);
      },
    }),
  ];
};

export const getVisualLineBox = ({
  rectTop,
  rectHeight,
  blockTop,
  blockHeight,
  lineHeight,
}: VisualLineBoxInput): VisualLineBox | null => {
  if (
    !Number.isFinite(rectTop) ||
    !Number.isFinite(rectHeight) ||
    !Number.isFinite(blockTop) ||
    !Number.isFinite(blockHeight) ||
    !Number.isFinite(lineHeight)
  ) {
    return null;
  }

  if (rectHeight <= 0 || blockHeight <= 0 || lineHeight <= 0) {
    return null;
  }

  const center = rectTop + rectHeight / 2;
  const relativeCenter = center - blockTop;
  if (relativeCenter < 0 || relativeCenter > blockHeight) {
    return null;
  }

  const rowCount = Math.max(1, Math.floor(blockHeight / lineHeight));
  const rawRowIndex = Math.floor(relativeCenter / lineHeight);
  const rowIndex = Math.min(rowCount - 1, Math.max(0, rawRowIndex));

  return {
    top: blockTop + rowIndex * lineHeight,
    height: lineHeight,
  };
};

export const getNonWidgetTextBlocks = (blocks: PaintBlock[]): PaintBlock[] => {
  return blocks.filter((block) => {
    return block.widget === null && block.height > 0;
  });
};

export type InlineRangeSegment = {
  from: number;
  to: number;
};

export type PositionSide = -1 | 1;

export type PositionRowLookup = (
  position: number,
  side: PositionSide,
) => number | null;

type InlineRangeTarget = Extract<DiffPaintTarget, { type: 'range' }>;
type MarkerTarget = Extract<DiffPaintTarget, { type: 'marker' }>;

export const getLineBoundedRangeSegments = ({
  text,
  from,
  to,
}: {
  text: string;
  from: number;
  to: number;
}): InlineRangeSegment[] => {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from < 0 ||
    to <= from ||
    to > text.length
  ) {
    return [];
  }

  const segments: InlineRangeSegment[] = [];
  let segmentStart = from;
  let index = from;

  while (index < to) {
    const character = text[index];
    const isLineBreak = character === '\n' || character === '\r';

    if (!isLineBreak) {
      index += 1;
      continue;
    }

    if (segmentStart < index) {
      segments.push({ from: segmentStart, to: index });
    }

    if (character === '\r' && text[index + 1] === '\n') {
      index += 2;
    } else {
      index += 1;
    }
    segmentStart = index;
  }

  if (segmentStart < to) {
    segments.push({ from: segmentStart, to });
  }

  return segments;
};

export const getVisualRowRangeSegments = ({
  from,
  to,
  lineHeight,
  getPositionTop,
}: {
  from: number;
  to: number;
  lineHeight: number;
  getPositionTop: PositionRowLookup;
}): InlineRangeSegment[] => {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to <= from ||
    !Number.isFinite(lineHeight) ||
    lineHeight <= 0
  ) {
    return [];
  }

  const segments: InlineRangeSegment[] = [];
  let start = from;
  const rowTolerance = Math.max(1, lineHeight / 3);

  while (start < to) {
    const startTop = getPositionTop(start, 1);
    if (startTop === null || !Number.isFinite(startTop)) {
      return [];
    }
    const rowTop = startTop;

    let low = start + 1;
    let high = to;
    let best = start;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const endTop = getPositionTop(mid, -1);
      if (endTop === null || !Number.isFinite(endTop)) {
        high = mid - 1;
        continue;
      }
      const rowEndTop = endTop;

      const sameRow = Math.abs(rowTop - rowEndTop) < rowTolerance;
      if (sameRow) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best <= start) {
      return [];
    }

    segments.push({ from: start, to: best });
    start = best;
  }

  return segments;
};

export const isMarkerInsideInlineRange = ({
  marker,
  range,
}: {
  marker: MarkerTarget;
  range: InlineRangeTarget;
}): boolean => {
  return marker.position > range.from && marker.position < range.to;
};

export const getMarkerTargetsOutsideInlineRangeInteriors = ({
  markers,
  ranges,
}: {
  markers: MarkerTarget[];
  ranges: InlineRangeTarget[];
}): MarkerTarget[] => {
  return markers.filter((marker) => {
    return !ranges.some((range) => {
      return isMarkerInsideInlineRange({ marker, range });
    });
  });
};

export const getVisibleDiffPaintTargets = ({
  targets,
  visibleRanges,
  docLineCount,
  getLineRange,
}: {
  targets: DiffPaintTarget[];
  visibleRanges: readonly VisibleTextRange[];
  docLineCount: number;
  getLineRange: (lineNumber: number) => VisibleTextRange | null;
}): DiffPaintTarget[] => {
  const bufferedVisibleRanges = visibleRanges
    .map((range) => {
      if (range.to < range.from) {
        return null;
      }

      return {
        from: Math.max(0, range.from - VISIBLE_RANGE_BUFFER_CHARS),
        to: range.to + VISIBLE_RANGE_BUFFER_CHARS,
      };
    })
    .filter((range): range is VisibleTextRange => range !== null);

  if (bufferedVisibleRanges.length === 0) {
    return [];
  }

  return targets.filter((target) => {
    if (target.type === 'line') {
      if (!isValidLineNumber(target.lineNumber, docLineCount)) {
        return false;
      }

      const lineRange = getLineRange(target.lineNumber);
      if (!lineRange) {
        return false;
      }

      return bufferedVisibleRanges.some((visibleRange) =>
        rangesOverlap(lineRange, visibleRange),
      );
    }

    return bufferedVisibleRanges.some((visibleRange) =>
      rangesOverlap({ from: target.from, to: target.to }, visibleRange),
    );
  });
};

// === Helpers ===

const getDiffPaintMarkers = (
  view: EditorView,
  theme: CodeMirrorTheme,
): readonly LayerMarker[] => {
  const diffPaint = view.state.field(diffPaintField);
  if (diffPaint.isTyping) {
    const typingDiff = view.state.field(typingDiffDecorationsField);
    const activeLineMarkers = getLineMarkers(
      view,
      getActiveLineDiffPaintTargets(
        view.state.doc.lineAt(view.state.selection.main.head).number,
      ),
    );
    const tickMarkers = getMarkerTickMarkers(
      view,
      getTypingTickTargets({
        doc: view.state.doc,
        tickMarkers: typingDiff.tickMarkers,
      }),
    );

    return [...activeLineMarkers, ...tickMarkers];
  }

  const targets = getDiffPaintTargets({
    theme,
    text: view.state.doc.toString(),
    docLineCount: view.state.doc.lines,
    activeLineNumber: view.state.doc.lineAt(view.state.selection.main.head).number,
    diffPaint,
  });
  const visibleTargets = getVisibleDiffPaintTargets({
    targets,
    visibleRanges: view.visibleRanges,
    docLineCount: view.state.doc.lines,
    getLineRange: (lineNumber) => {
      if (!isValidLineNumber(lineNumber, view.state.doc.lines)) {
        return null;
      }

      const line = view.state.doc.line(lineNumber);
      return { from: line.from, to: line.to };
    },
  });

  const activeLineTargets = visibleTargets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'line' }> => {
      return target.type === 'line' && target.className === 'diff-diff-active-line';
    },
  );
  const lineTargets = visibleTargets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'line' }> => {
      return target.type === 'line' && target.className !== 'diff-diff-active-line';
    },
  );
  const rangeTargets = visibleTargets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'range' }> => {
      return target.type === 'range';
    },
  );
  const markerTargets = visibleTargets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'marker' }> => {
      return target.type === 'marker';
    },
  );

  return [
    ...getLineMarkers(view, activeLineTargets),
    ...getLineMarkers(view, lineTargets),
    ...getRangeMarkers(view, rangeTargets),
    ...getMarkerTickMarkers(view, markerTargets),
  ];
};

const getLowestEditedLineMarkers = (view: EditorView): RectangleMarker[] => {
  const diffPaint = view.state.field(diffPaintField);
  const { lowestEditedLine } = diffPaint;
  if (!lowestEditedLine) {
    return [];
  }

  if (!isValidLineNumber(lowestEditedLine.lineNumber, view.state.doc.lines)) {
    return [];
  }

  const contentWidth = getContentWidth(view);
  if (contentWidth <= 0) {
    return [];
  }
  const lineNumberLayout = getDiffPaintLineNumberLayout(view);

  return getLowestEditedLineRuleMarkers({
    view,
    lineNumber: lowestEditedLine.lineNumber,
    contentWidth,
    lineNumberLayout,
  });
};

const getLineMarkers = (
  view: EditorView,
  targets: Array<Extract<DiffPaintTarget, { type: 'line' }>>,
): RectangleMarker[] => {
  if (targets.length === 0) {
    return [];
  }

  const contentWidth = getContentWidth(view);
  if (contentWidth <= 0) {
    return [];
  }
  const lineNumberLayout = getDiffPaintLineNumberLayout(view);

  const markers: RectangleMarker[] = [];
  for (const target of targets) {
    markers.push(
      ...getLineBlockMarkers({
        view,
        className: target.className,
        geometryRole: target.geometryRole,
        lineNumber: target.lineNumber,
        contentWidth,
        lineNumberLayout,
      }),
    );
  }

  return markers;
};

const getRangeMarkers = (
  view: EditorView,
  targets: Array<Extract<DiffPaintTarget, { type: 'range' }>>,
): RectangleMarker[] => {
  const markers: RectangleMarker[] = [];

  for (const target of targets) {
    const boxes = getNormalizedRangeBoxes(view, target.className, target.from, target.to);
    const adjustment = DIFF_PAINT_GEOMETRY[target.geometryRole];

    markers.push(
      ...boxes
        .map((box) => getAdjustedPaintRectBox(box, adjustment))
        .filter((box): box is PaintRectBox => box !== null)
        .map((box) => {
          return new RectangleMarker(
            target.className,
            box.left,
            box.top,
            box.width,
            box.height,
          );
        }),
    );
  }

  return markers;
};

const getMarkerTickMarkers = (
  view: EditorView,
  targets: Array<Extract<DiffPaintTarget, { type: 'marker' }>>,
): RectangleMarker[] => {
  const markers: RectangleMarker[] = [];

  for (const target of targets) {
    const rects = getNormalizedRangeBoxes(view, target.className, target.from, target.to);
    const adjustment = DIFF_PAINT_GEOMETRY[target.geometryRole];
    const tickWidth = adjustment.widthPx ?? DIFF_TICK_WIDTH_PX;

    for (const rect of rects) {
      const width = Math.min(rect.width, tickWidth);
      const right = rect.left + rect.width;
      const left = target.side === 'left' ? rect.left : right - width;
      const adjustedTickBox = getAdjustedPaintRectBox(
        {
          left,
          top: rect.top,
          width,
          height: rect.height,
        },
        adjustment,
      );
      if (!adjustedTickBox) {
        continue;
      }

      markers.push(
        new RectangleMarker(
          target.className,
          adjustedTickBox.left,
          adjustedTickBox.top,
          adjustedTickBox.width,
          adjustedTickBox.height,
        ),
      );
    }
  }

  return markers;
};

const getMarkerRangeInDoc = ({
  doc,
  position,
}: {
  doc: Text;
  position: number;
}): { from: number; to: number; side: MarkerSide } | null => {
  if (!Number.isInteger(position) || position < 0 || position > doc.length) {
    return null;
  }

  const clampedPosition = Math.max(0, Math.min(doc.length, position));
  const line = doc.lineAt(clampedPosition);
  if (line.from === line.to) {
    return null;
  }

  if (clampedPosition < line.to) {
    return {
      from: clampedPosition,
      to: clampedPosition + 1,
      side: 'left',
    };
  }

  if (clampedPosition > line.from) {
    return {
      from: clampedPosition - 1,
      to: clampedPosition,
      side: 'right',
    };
  }

  return null;
};

const getTypingTickTargets = ({
  doc,
  tickMarkers,
}: {
  doc: Text;
  tickMarkers: TypingDiffTickMarker[];
}): Array<Extract<DiffPaintTarget, { type: 'marker' }>> => {
  return tickMarkers.flatMap((marker) => {
    const markerRange = getMarkerRangeInDoc({
      doc,
      position: marker.position,
    });
    if (!markerRange) {
      return [];
    }

    return [
      {
        type: 'marker',
        className: marker.className,
        from: markerRange.from,
        to: markerRange.to,
        side: markerRange.side,
        position: marker.position,
        geometryRole: 'tick',
      },
    ];
  });
};

const getEditorRangeTargets = (
  ranges: EditorHighlightRange[],
  docLength: number,
  docText: string,
): DiffPaintTarget[] => {
  const rangeTargets: InlineRangeTarget[] = [];
  const markerTargets: MarkerTarget[] = [];

  for (const range of ranges) {
    const validRange = getValidRange(range.from, range.to, docLength, true);
    if (!validRange) {
      continue;
    }

    if (range.type === 'added') {
      if (validRange.from === validRange.to) {
        continue;
      }

      rangeTargets.push({
        type: 'range',
        className: 'diff-diff-added',
        from: validRange.from,
        to: validRange.to,
        geometryRole: 'inlineText',
      });
      continue;
    }

    if (validRange.from !== validRange.to) {
      continue;
    }

    const markerRange = getMarkerRange({
      text: docText,
      position: validRange.from,
    });
    if (!markerRange) {
      continue;
    }

    markerTargets.push({
      type: 'marker',
      className: 'diff-diff-deleted',
      from: markerRange.from,
      to: markerRange.to,
      side: markerRange.side,
      position: validRange.from,
      geometryRole: 'tick',
    });
  }

  const visibleMarkerTargets = getMarkerTargetsOutsideInlineRangeInteriors({
    markers: markerTargets,
    ranges: rangeTargets,
  });

  return [...rangeTargets, ...visibleMarkerTargets];
};

const getDraftRangeTargets = (
  ranges: DraftHighlightRange[],
  docLength: number,
  docText: string,
): DiffPaintTarget[] => {
  const rangeTargets: InlineRangeTarget[] = [];
  const markerTargets: MarkerTarget[] = [];

  for (const range of ranges) {
    const validRange = getValidRange(range.from, range.to, docLength, true);
    if (!validRange) {
      continue;
    }

    if (range.type === 'deleted') {
      if (validRange.from === validRange.to) {
        continue;
      }

      rangeTargets.push({
        type: 'range',
        className: 'diff-diff-deleted',
        from: validRange.from,
        to: validRange.to,
        geometryRole: 'inlineText',
      });
      continue;
    }

    if (validRange.from !== validRange.to) {
      continue;
    }

    const markerRange = getMarkerRange({
      text: docText,
      position: validRange.from,
    });
    if (!markerRange) {
      continue;
    }

    markerTargets.push({
      type: 'marker',
      className: 'diff-diff-added',
      from: markerRange.from,
      to: markerRange.to,
      side: markerRange.side,
      position: validRange.from,
      geometryRole: 'tick',
    });
  }

  const visibleMarkerTargets = getMarkerTargetsOutsideInlineRangeInteriors({
    markers: markerTargets,
    ranges: rangeTargets,
  });

  return [...rangeTargets, ...visibleMarkerTargets];
};

const getEditorLineTargets = (
  lines: EditorLineDecoration[],
  docLineCount: number,
): DiffPaintTarget[] => {
  const targets: DiffPaintTarget[] = [];

  for (const line of lines) {
    if (!isValidLineNumber(line.lineNumber, docLineCount)) {
      continue;
    }

    targets.push({
      type: 'line',
      className: 'diff-diff-added',
      lineNumber: line.lineNumber,
      geometryRole: 'fullLine',
    });
  }

  return targets;
};

const getDraftLineTargets = (
  lines: DraftLineDecoration[],
  docLineCount: number,
): DiffPaintTarget[] => {
  const targets: DiffPaintTarget[] = [];

  for (const line of lines) {
    if (line.type !== 'deletedDraftLine') {
      continue;
    }

    if (!isValidLineNumber(line.lineNumber, docLineCount)) {
      continue;
    }

    targets.push({
      type: 'line',
      className: 'diff-diff-deleted',
      lineNumber: line.lineNumber,
      geometryRole: 'fullLine',
    });
  }

  return targets;
};

const mapHighlightRangeThroughChanges = <
  T extends EditorHighlightRange | DraftHighlightRange,
>(
  range: T,
  changes: ChangeDesc,
): T | null => {
  if (range.from === range.to) {
    const mappedPosition = changes.mapPos(range.from, 1);
    return {
      ...range,
      from: mappedPosition,
      to: mappedPosition,
    };
  }

  const from = changes.mapPos(range.from, 1);
  const to = changes.mapPos(range.to, -1);
  if (to < from) {
    return null;
  }

  return {
    ...range,
    from,
    to,
  };
};

const rangesOverlap = (
  left: VisibleTextRange,
  right: VisibleTextRange,
): boolean => {
  return left.from <= right.to && right.from <= left.to;
};

const isValidLineNumber = (lineNumber: number, docLineCount: number): boolean => {
  return Number.isInteger(lineNumber) && lineNumber >= 1 && lineNumber <= docLineCount;
};

const getValidRange = (
  from: number,
  to: number,
  docLength: number,
  allowEmpty = false,
): { from: number; to: number } | null => {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(docLength)) {
    return null;
  }

  if (docLength < 0) {
    return null;
  }

  if (from < 0 || to < 0 || from > docLength || to > docLength) {
    return null;
  }

  if (to < from) {
    return null;
  }

  if (!allowEmpty && from === to) {
    return null;
  }

  return { from, to };
};

const getValidTypingDiffRange = ({
  from,
  to,
  docLength,
}: {
  from: number;
  to: number;
  docLength: number;
}): { from: number; to: number } | null => {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(docLength)) {
    return null;
  }

  if (docLength < 0) {
    return null;
  }

  const clampedFrom = Math.max(0, Math.min(docLength, from));
  const clampedTo = Math.max(0, Math.min(docLength, to));
  if (clampedTo <= clampedFrom) {
    return null;
  }

  return {
    from: clampedFrom,
    to: clampedTo,
  };
};

const getValidTypingDiffPosition = ({
  position,
  docLength,
}: {
  position: number;
  docLength: number;
}): number | null => {
  if (!Number.isFinite(position) || !Number.isFinite(docLength)) {
    return null;
  }

  if (docLength < 0 || position < 0 || position > docLength) {
    return null;
  }

  return position;
};

const getEditorTypingDecorations = ({
  ranges,
  docLength,
}: {
  ranges: EditorHighlightRange[];
  docLength: number;
}) => {
  const inlineRanges = getMergedTypingInlineRanges(
    ranges
      .filter((range) => range.type === 'added')
      .map((range) =>
        getValidTypingDiffRange({
          from: range.from,
          to: range.to,
          docLength,
        }),
      )
      .filter((range): range is TypingInlineRange => range !== null),
  );
  const marks = inlineRanges.map((range) =>
    Decoration.mark({ class: TYPING_DIFF_ADDED_CLASS_NAME }).range(
      range.from,
      range.to,
    ),
  );
  const tickMarkers = ranges.flatMap((range) => {
    if (range.type !== 'deleted' || range.from !== range.to) {
      return [];
    }

    const validPosition = getValidTypingDiffPosition({
      position: range.from,
      docLength,
    });
    if (validPosition === null) {
      return [];
    }

    if (
      isTypingTickInsideInlineRange({
        position: validPosition,
        inlineRanges,
      })
    ) {
      return [];
    }

    return [
      {
        className: 'diff-diff-deleted' as const,
        position: validPosition,
      },
    ];
  });

  return {
    marks,
    tickMarkers,
  };
};

const getDraftTypingDecorations = ({
  ranges,
  docLength,
}: {
  ranges: DraftHighlightRange[];
  docLength: number;
}) => {
  const inlineRanges = getMergedTypingInlineRanges(
    ranges
      .filter((range) => range.type === 'deleted')
      .map((range) =>
        getValidTypingDiffRange({
          from: range.from,
          to: range.to,
          docLength,
        }),
      )
      .filter((range): range is TypingInlineRange => range !== null),
  );
  const marks = inlineRanges.map((range) =>
    Decoration.mark({ class: TYPING_DIFF_DELETED_CLASS_NAME }).range(
      range.from,
      range.to,
    ),
  );
  const tickMarkers = ranges.flatMap((range) => {
    if (range.type !== 'added' || range.from !== range.to) {
      return [];
    }

    const validPosition = getValidTypingDiffPosition({
      position: range.from,
      docLength,
    });
    if (validPosition === null) {
      return [];
    }

    if (
      isTypingTickInsideInlineRange({
        position: validPosition,
        inlineRanges,
      })
    ) {
      return [];
    }

    return [
      {
        className: 'diff-diff-added' as const,
        position: validPosition,
      },
    ];
  });

  return {
    marks,
    tickMarkers,
  };
};

const isTypingTickInsideInlineRange = ({
  position,
  inlineRanges,
}: {
  position: number;
  inlineRanges: TypingInlineRange[];
}): boolean => {
  return inlineRanges.some((range) => {
    return range.from < position && position < range.to;
  });
};

const getMergedTypingInlineRanges = (ranges: TypingInlineRange[]): TypingInlineRange[] => {
  const sortedRanges = ranges
    .filter((range) => range.to > range.from)
    .slice()
    .sort((left, right) => {
      if (left.from !== right.from) {
        return left.from - right.from;
      }

      return left.to - right.to;
    });
  if (sortedRanges.length === 0) {
    return [];
  }

  const mergedRanges: TypingInlineRange[] = [];
  let currentRange = sortedRanges[0];
  for (let index = 1; index < sortedRanges.length; index += 1) {
    const nextRange = sortedRanges[index];
    if (nextRange.from <= currentRange.to) {
      currentRange = {
        from: currentRange.from,
        to: Math.max(currentRange.to, nextRange.to),
      };
      continue;
    }

    mergedRanges.push(currentRange);
    currentRange = nextRange;
  }

  mergedRanges.push(currentRange);
  return mergedRanges;
};

const getContentWidth = (view: EditorView): number => {
  const width = view.contentDOM.clientWidth || view.scrollDOM.clientWidth;
  return width > 0 ? width : 0;
};

const getDiffPaintLineNumberLayout = (
  view: EditorView,
): DiffPaintLineNumberLayout => {
  const settings = view.state.field(lineNumberSettingsField, false);
  if (
    settings &&
    settings.position === 'left' &&
    shouldShowLineNumberGutter(settings)
  ) {
    return 'reservedLeftGutter';
  }

  return 'noReservedLeftGutter';
};

const getLineHeight = (view: EditorView): number => {
  return Math.max(1, view.defaultLineHeight);
};

const getReservedLeftGutterWidthPx = (view: EditorView): number => {
  const settings = view.state.field(lineNumberSettingsField, false);

  if (
    !settings ||
    settings.position !== 'left' ||
    !shouldShowLineNumberGutter(settings)
  ) {
    return DIFF_CONTENT_HORIZONTAL_PADDING_PX;
  }

  return getVisibleLineNumberGutterWidthPx(view);
};

const getLineBlockMarkers = ({
  view,
  className,
  geometryRole,
  lineNumber,
  contentWidth,
  lineNumberLayout,
}: {
  view: EditorView;
  className: DiffPaintClassName;
  geometryRole: DiffPaintGeometryRole;
  lineNumber: number;
  contentWidth: number;
  lineNumberLayout: DiffPaintLineNumberLayout;
}): RectangleMarker[] => {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return [];
  }

  const line = view.state.doc.line(lineNumber);
  const block = view.lineBlockAt(line.from);
  const textBlocks = getTextBlocksFromLineBlock(block);
  const lineHeight = getLineHeight(view);
  const adjustment = getLinePaintGeometryAdjustment({
    geometryRole,
    lineNumberLayout,
    reservedLeftGutterWidthPx: getReservedLeftGutterWidthPx(view),
  });
  const markers: RectangleMarker[] = [];

  for (const textBlock of textBlocks) {
    const rowCount = Math.max(1, Math.floor(textBlock.height / lineHeight));
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const adjustedBox = getAdjustedPaintRectBox(
        {
          left: 0,
          top: textBlock.top + rowIndex * lineHeight,
          width: contentWidth,
          height: lineHeight,
        },
        adjustment,
      );
      if (!adjustedBox) {
        continue;
      }

      markers.push(
        new RectangleMarker(
          className,
          adjustedBox.left,
          adjustedBox.top,
          adjustedBox.width,
          adjustedBox.height,
        ),
      );
    }
  }

  return markers;
};

const getLowestEditedLineRuleMarkers = ({
  view,
  lineNumber,
  contentWidth,
  lineNumberLayout,
}: {
  view: EditorView;
  lineNumber: number;
  contentWidth: number;
  lineNumberLayout: DiffPaintLineNumberLayout;
}): RectangleMarker[] => {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return [];
  }

  const line = view.state.doc.line(lineNumber);
  const block = view.lineBlockAt(line.from);
  const textBlocks = getTextBlocksFromLineBlock(block);
  if (textBlocks.length === 0) {
    return [];
  }

  const lineHeight = getLineHeight(view);
  const lastTextBlock = textBlocks[textBlocks.length - 1];
  const rowCount = Math.max(1, Math.floor(lastTextBlock.height / lineHeight));
  const finalTextRowTop = lastTextBlock.top + (rowCount - 1) * lineHeight;

  const ruleBox = getLowestEditedLineRuleBox({
    left: 0,
    top: finalTextRowTop,
    width: contentWidth,
    height: lineHeight,
  }, getLinePaintGeometryAdjustment({
    geometryRole: 'lowestEditedLine',
    lineNumberLayout,
    reservedLeftGutterWidthPx: getReservedLeftGutterWidthPx(view),
  }));
  if (!ruleBox) {
    return [];
  }

  return [
    new RectangleMarker(
      'diff-lowest-edited-line-marker',
      ruleBox.left,
      ruleBox.top,
      ruleBox.width,
      ruleBox.height,
    ),
  ];
};

const getNormalizedRangeBoxes = (
  view: EditorView,
  className: 'diff-diff-added' | 'diff-diff-deleted',
  from: number,
  to: number,
): PaintRectBox[] => {
  const boxes: PaintRectBox[] = [];
  const segments = getLineBoundedRangeSegments({
    text: view.state.doc.toString(),
    from,
    to,
  });

  for (const segment of segments) {
    const visualSegments = getViewVisualRowRangeSegments(view, segment);

    for (const visualSegment of visualSegments) {
      const rects = RectangleMarker.forRange(
        view,
        className,
        EditorSelection.range(visualSegment.from, visualSegment.to),
      );

      for (const rect of rects) {
        if (rect.width === null || rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const lineBox = getLineBoxForRect(view, rect);
        if (!lineBox) {
          continue;
        }

        boxes.push({
          left: rect.left,
          top: lineBox.top,
          width: rect.width,
          height: lineBox.height,
        });
      }
    }
  }

  return boxes;
};

const getViewVisualRowRangeSegments = (
  view: EditorView,
  segment: InlineRangeSegment,
): InlineRangeSegment[] => {
  const lineHeight = getLineHeight(view);
  const visualSegments = getVisualRowRangeSegments({
    from: segment.from,
    to: segment.to,
    lineHeight,
    getPositionTop(position, side) {
      const coords = view.coordsAtPos(position, side);
      return coords ? coords.top : null;
    },
  });

  return visualSegments.length > 0 ? visualSegments : [segment];
};

const getLineBoxForRect = (
  view: EditorView,
  rect: RectangleMarker,
): VisualLineBox | null => {
  if (rect.height <= 0) {
    return null;
  }

  const center = rect.top + rect.height / 2;
  const block = view.lineBlockAtHeight(center);
  const lineHeight = getLineHeight(view);
  const textBlock = getBestTextBlockForCenter(block, center);

  if (!textBlock) {
    return null;
  }

  return getVisualLineBox({
    rectTop: rect.top,
    rectHeight: rect.height,
    blockTop: textBlock.top,
    blockHeight: textBlock.height,
    lineHeight,
  });
};

const getTextBlocksFromLineBlock = (lineBlock: unknown): PaintBlock[] => {
  const blockArray = getBlockArray(lineBlock);
  if (blockArray.length === 0) {
    return [];
  }

  const textBlocks = getNonWidgetTextBlocks(blockArray);
  if (textBlocks.length > 0) {
    return textBlocks;
  }

  if (blockArray.length !== 1 || blockArray[0].widget !== null) {
    return [];
  }

  return [blockArray[0]];
};

const getBestTextBlockForCenter = (
  lineBlock: unknown,
  center: number,
): PaintBlock | null => {
  const textBlocks = getTextBlocksFromLineBlock(lineBlock);

  for (const block of textBlocks) {
    const bottom = block.top + block.height;
    if (center >= block.top && center < bottom) {
      return block;
    }
  }

  return textBlocks[0] ?? null;
};

const getBlockArray = (lineBlock: unknown): PaintBlock[] => {
  if (!lineBlock || typeof lineBlock !== 'object') {
    return [];
  }

  const candidate = lineBlock as {
    top?: unknown;
    height?: unknown;
    widget?: unknown;
    type?: unknown;
  };
  const typeValue = candidate.type;
  if (Array.isArray(typeValue)) {
    return typeValue
      .map((value) => getSingleBlock(value))
      .filter((value): value is PaintBlock => value !== null);
  }

  const single = getSingleBlock(lineBlock);
  return single ? [single] : [];
};

const getSingleBlock = (value: unknown): PaintBlock | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { top?: unknown; height?: unknown; widget?: unknown };
  if (!Number.isFinite(candidate.top) || !Number.isFinite(candidate.height)) {
    return null;
  }

  return {
    top: Number(candidate.top),
    height: Number(candidate.height),
    widget: candidate.widget ?? null,
  };
};
