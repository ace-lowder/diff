import { StateEffect, StateField, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';

import type {
  EditorHighlightRange,
  DraftHighlightRange,
  DraftLineDecoration,
  EditorLineDecoration,
  LowestEditedLine,
} from '../editorDiff';
import { normalizeFontStyleRanges, type FontStyleRange, type FontStyleType } from '../fontStyles';
import { CODE_MIRROR_LINE_HEIGHT } from './codeMirrorThemeConstants';
import { DIFF_PAINT_GEOMETRY } from './codeMirrorDiffPaintGeometry';
import { getMissingLineWidgetAnchor } from './missingLineAnchors';

export type CodeMirrorDecorations = {
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
  fontStyleRanges: FontStyleRange[];
  lowestEditedLine: LowestEditedLine | null;
};

export const setEditorDecorationsEffect = StateEffect.define<DecorationSet>();

export const editorDecorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorDecorationsEffect)) {
        return effect.value;
      }
    }

    if (transaction.docChanged) {
      // Decorations are recomputed from React state, so stale sets are cleared on
      // edits instead of mapped through document changes.
      return Decoration.none;
    }

    return decorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const getCodeMirrorDecorationsInput = ({
  editorHighlightRanges,
  draftHighlightRanges,
  editorLineDecorations,
  draftLineDecorations,
  fontStyleRanges,
  lowestEditedLine,
}: {
  editorHighlightRanges?: EditorHighlightRange[];
  draftHighlightRanges?: DraftHighlightRange[];
  editorLineDecorations?: EditorLineDecoration[];
  draftLineDecorations?: DraftLineDecoration[];
  fontStyleRanges?: FontStyleRange[];
  lowestEditedLine?: LowestEditedLine | null;
}): CodeMirrorDecorations => {
  return {
    editorHighlightRanges: editorHighlightRanges ?? [],
    draftHighlightRanges: draftHighlightRanges ?? [],
    editorLineDecorations: editorLineDecorations ?? [],
    draftLineDecorations: draftLineDecorations ?? [],
    fontStyleRanges: normalizeFontStyleRanges(fontStyleRanges ?? []),
    lowestEditedLine: lowestEditedLine ?? null,
  };
};

export const getCodeMirrorDecorations = (
  editorView: EditorView,
  decorations: CodeMirrorDecorations,
): DecorationSet => {
  const docLength = editorView.state.doc.length;
  const docText = editorView.state.doc.toString();
  const ranges: Range<Decoration>[] = [
    ...getFontStyleDecorations(decorations.fontStyleRanges, docLength),
    ...getDraftLineDecorations(
      editorView,
      decorations.draftLineDecorations,
      docText,
    ),
    ...getLowestEditedLineDecorations(editorView, decorations.lowestEditedLine),
  ];

  return Decoration.set(ranges, true);
};

class MissingLineWidget extends WidgetType {
  private readonly lineCount: number;

  constructor(lineCount: number) {
    super();
    this.lineCount = lineCount;
  }

  eq(other: MissingLineWidget) {
    return this.lineCount === other.lineCount;
  }

  toDOM() {
    const adjustment = DIFF_PAINT_GEOMETRY.missingLine;
    const spacer = document.createElement('div');
    const paint = document.createElement('div');

    spacer.className = 'byline-missing-line';
    spacer.style.height = `calc(${this.lineCount} * ${CODE_MIRROR_LINE_HEIGHT})`;
    spacer.style.position = 'relative';
    spacer.style.display = 'block';
    spacer.style.lineHeight = CODE_MIRROR_LINE_HEIGHT;
    spacer.style.boxSizing = 'border-box';
    spacer.style.margin = '0';
    spacer.style.padding = '0';
    spacer.style.border = '0';
    spacer.contentEditable = 'false';
    spacer.tabIndex = -1;
    spacer.setAttribute('aria-hidden', 'true');

    paint.className = 'byline-missing-line-paint';
    paint.style.position = 'absolute';
    paint.style.top = `${adjustment.topOffsetPx}px`;
    paint.style.left = `${adjustment.leftOffsetPx}px`;
    paint.style.height = `calc(${this.lineCount} * ${CODE_MIRROR_LINE_HEIGHT} + ${adjustment.bottomOffsetPx - adjustment.topOffsetPx}px)`;
    paint.style.width = `calc(100% + ${adjustment.rightOffsetPx - adjustment.leftOffsetPx}px)`;

    spacer.appendChild(paint);

    return spacer;
  }

  ignoreEvent() {
    return true;
  }
}

const getDraftLineDecorations = (
  editorView: EditorView,
  draftLineDecorations: DraftLineDecoration[],
  docText: string,
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const decoration of draftLineDecorations) {
    if (
      decoration.lineNumber < 1 ||
      decoration.lineNumber > editorView.state.doc.lines
    ) {
      continue;
    }

    if (decoration.type === 'deletedDraftLine') {
      continue;
    }

    const anchor = getMissingLineWidgetAnchor({
      docText,
      lineNumber: decoration.lineNumber,
      placement: decoration.placement,
    });
    if (!anchor) {
      continue;
    }

    decorations.push(
      Decoration.widget({
        block: true,
        side: anchor.side,
        widget: new MissingLineWidget(decoration.lineCount),
      }).range(anchor.position),
    );
  }

  return decorations;
};

const getLowestEditedLineDecorations = (
  editorView: EditorView,
  lowestEditedLine: LowestEditedLine | null,
): Range<Decoration>[] => {
  if (!lowestEditedLine) {
    return [];
  }

  if (
    lowestEditedLine.lineNumber < 1 ||
    lowestEditedLine.lineNumber > editorView.state.doc.lines
  ) {
    return [];
  }

  const line = editorView.state.doc.line(lowestEditedLine.lineNumber);
  return [Decoration.line({ class: 'byline-lowest-edited-line' }).range(line.from)];
};

const getFontStyleDecorations = (
  fontStyleRanges: FontStyleRange[],
  docLength: number,
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of fontStyleRanges) {
    const validRange = getValidTextRange({
      from: range.from,
      to: range.to,
      docLength,
    });

    if (!validRange) {
      continue;
    }

    const className = getFontStyleClassName(range.type);
    if (!className) {
      continue;
    }

    decorations.push(
      Decoration.mark({ class: className }).range(validRange.from, validRange.to),
    );
  }

  return decorations;
};

const getFontStyleClassName = (fontStyleType: FontStyleType): string | null => {
  if (fontStyleType === 'bold') {
    return 'byline-font-bold';
  }

  if (fontStyleType === 'italic') {
    return 'byline-font-italic';
  }

  if (fontStyleType === 'underline') {
    return 'byline-font-underline';
  }

  return null;
};

type ValidTextRange = {
  from: number;
  to: number;
};

const getValidTextRange = ({
  from,
  to,
  docLength,
  allowEmpty = false,
}: {
  from: number;
  to: number;
  docLength: number;
  allowEmpty?: boolean;
}): ValidTextRange | null => {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    !Number.isFinite(docLength) ||
    docLength < 0
  ) {
    return null;
  }

  const clampedFrom = Math.min(docLength, Math.max(0, from));
  const clampedTo = Math.min(docLength, Math.max(0, to));

  if (clampedTo < clampedFrom) {
    return null;
  }

  if (clampedTo === clampedFrom && !allowEmpty) {
    return null;
  }

  return {
    from: clampedFrom,
    to: clampedTo,
  };
};
