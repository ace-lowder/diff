import { EditorSelection, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, RectangleMarker, layer, type LayerMarker } from '@codemirror/view';

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
  DIFF_PAINT_GEOMETRY,
  DIFF_TICK_WIDTH_PX,
  getAdjustedPaintRectBox,
  getLowestEditedLineRuleBox,
  type DiffPaintGeometryRole,
  type PaintRectBox,
} from './codeMirrorDiffPaintGeometry';
import { getMarkerRange, type MarkerSide } from './markerRanges';

export type DiffPaintClassName =
  | 'byline-diff-added'
  | 'byline-diff-deleted'
  | 'byline-diff-active-line';

export type DiffPaintTarget =
  | {
      type: 'range';
      className: 'byline-diff-added' | 'byline-diff-deleted';
      from: number;
      to: number;
      geometryRole: DiffPaintGeometryRole;
    }
  | {
      type: 'marker';
      className: 'byline-diff-added' | 'byline-diff-deleted';
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

type PaintBlock = {
  top: number;
  height: number;
  widget: unknown | null;
};

export const setDiffPaintEffect = StateEffect.define<DiffPaintState>();

export const diffPaintField = StateField.define<DiffPaintState>({
  create() {
    return {
      editorHighlightRanges: [],
      draftHighlightRanges: [],
      editorLineDecorations: [],
      draftLineDecorations: [],
      lowestEditedLine: null,
    };
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiffPaintEffect)) {
        return effect.value;
      }
    }

    if (transaction.docChanged) {
      return {
        editorHighlightRanges: [],
        draftHighlightRanges: [],
        editorLineDecorations: [],
        draftLineDecorations: [],
        lowestEditedLine: null,
      };
    }

    return value;
  },
});

export const getDiffPaintEffectValue = (
  decorations: CodeMirrorDecorations,
): DiffPaintState => {
  return {
    editorHighlightRanges: decorations.editorHighlightRanges,
    draftHighlightRanges: decorations.draftHighlightRanges,
    editorLineDecorations: decorations.editorLineDecorations,
    draftLineDecorations: decorations.draftLineDecorations,
    lowestEditedLine: decorations.lowestEditedLine,
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

  if (theme === 'editor') {
    targets.push({
      type: 'line',
      className: 'byline-diff-active-line',
      lineNumber: activeLineNumber,
      geometryRole: 'activeLine',
    });
    targets.push(
      ...getEditorRangeTargets(diffPaint.editorHighlightRanges, docLength, text),
      ...getEditorLineTargets(diffPaint.editorLineDecorations, docLineCount),
    );

    return targets;
  }

  targets.push({
    type: 'line',
    className: 'byline-diff-active-line',
    lineNumber: activeLineNumber,
    geometryRole: 'activeLine',
  });
  targets.push(
    ...getDraftRangeTargets(diffPaint.draftHighlightRanges, docLength, text),
    ...getDraftLineTargets(diffPaint.draftLineDecorations, docLineCount),
  );

  return targets;
};

export const getCodeMirrorDiffPaintExtension = (
  theme: CodeMirrorTheme,
): Extension[] => {
  return [
    diffPaintField,
    layer({
      above: false,
      class: 'byline-diff-layer',
      update(update) {
        return (
          update.docChanged ||
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
      class: 'byline-diff-rule-layer',
      update(update) {
        return (
          update.docChanged ||
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

// === Helpers ===

const getDiffPaintMarkers = (
  view: EditorView,
  theme: CodeMirrorTheme,
): readonly LayerMarker[] => {
  const diffPaint = view.state.field(diffPaintField);
  const targets = getDiffPaintTargets({
    theme,
    text: view.state.doc.toString(),
    docLineCount: view.state.doc.lines,
    activeLineNumber: view.state.doc.lineAt(view.state.selection.main.head).number,
    diffPaint,
  });

  const activeLineTargets = targets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'line' }> => {
      return target.type === 'line' && target.className === 'byline-diff-active-line';
    },
  );
  const lineTargets = targets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'line' }> => {
      return target.type === 'line' && target.className !== 'byline-diff-active-line';
    },
  );
  const rangeTargets = targets.filter(
    (target): target is Extract<DiffPaintTarget, { type: 'range' }> => {
      return target.type === 'range';
    },
  );
  const markerTargets = targets.filter(
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
  const { lowestEditedLine } = view.state.field(diffPaintField);
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

  return getLowestEditedLineRuleMarkers({
    view,
    lineNumber: lowestEditedLine.lineNumber,
    contentWidth,
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

  const markers: RectangleMarker[] = [];
  for (const target of targets) {
    markers.push(
      ...getLineBlockMarkers({
        view,
        className: target.className,
        geometryRole: target.geometryRole,
        lineNumber: target.lineNumber,
        contentWidth,
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
        className: 'byline-diff-added',
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
      className: 'byline-diff-deleted',
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
        className: 'byline-diff-deleted',
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
      className: 'byline-diff-added',
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
      className: 'byline-diff-added',
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
      className: 'byline-diff-deleted',
      lineNumber: line.lineNumber,
      geometryRole: 'fullLine',
    });
  }

  return targets;
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

const getContentWidth = (view: EditorView): number => {
  const width = view.contentDOM.clientWidth || view.scrollDOM.clientWidth;
  return width > 0 ? width : 0;
};

const getLineHeight = (view: EditorView): number => {
  return Math.max(1, view.defaultLineHeight);
};

const getLineBlockMarkers = ({
  view,
  className,
  geometryRole,
  lineNumber,
  contentWidth,
}: {
  view: EditorView;
  className: DiffPaintClassName;
  geometryRole: DiffPaintGeometryRole;
  lineNumber: number;
  contentWidth: number;
}): RectangleMarker[] => {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return [];
  }

  const line = view.state.doc.line(lineNumber);
  const block = view.lineBlockAt(line.from);
  const textBlocks = getTextBlocksFromLineBlock(block);
  const lineHeight = getLineHeight(view);
  const adjustment = DIFF_PAINT_GEOMETRY[geometryRole];
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
}: {
  view: EditorView;
  lineNumber: number;
  contentWidth: number;
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
  });
  if (!ruleBox) {
    return [];
  }

  return [
    new RectangleMarker(
      'byline-lowest-edited-line-marker',
      ruleBox.left,
      ruleBox.top,
      ruleBox.width,
      ruleBox.height,
    ),
  ];
};

const getNormalizedRangeBoxes = (
  view: EditorView,
  className: 'byline-diff-added' | 'byline-diff-deleted',
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
