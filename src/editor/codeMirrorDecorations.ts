import { StateEffect, StateField, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';

import type {
  DraftHighlightRange,
  DraftLineDecoration,
  EditorHighlightRange,
  EditorLineDecoration,
  LowestEditedLine,
} from '../editorDiff';
import { normalizeFontStyleRanges, type FontStyleRange, type FontStyleType } from '../fontStyles';

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
  const ranges: Range<Decoration>[] = [
    ...getFontStyleDecorations(decorations.fontStyleRanges, docLength),
    ...getEditorHighlightDecorations(decorations.editorHighlightRanges, docLength),
    ...getDraftHighlightDecorations(decorations.draftHighlightRanges, docLength),
    ...getEditorLineDecorations(editorView, decorations.editorLineDecorations),
    ...getDraftLineDecorations(editorView, decorations.draftLineDecorations),
    ...getLowestEditedLineDecorations(editorView, decorations.lowestEditedLine),
  ];

  return Decoration.set(ranges, true);
};

class DeletedMarkerWidget extends WidgetType {
  toDOM() {
    const wrapper = document.createElement('span');
    const marker = document.createElement('span');

    wrapper.className = 'byline-deleted-marker';
    wrapper.setAttribute('aria-hidden', 'true');
    marker.className = 'byline-deleted-marker-strip';
    wrapper.append(marker);

    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

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
    const line = document.createElement('div');

    line.className = 'byline-missing-line';
    line.style.height = `${this.lineCount * 1.5}em`;
    line.contentEditable = 'false';
    line.tabIndex = -1;
    line.setAttribute('aria-hidden', 'true');

    return line;
  }

  ignoreEvent() {
    return true;
  }
}

const getEditorHighlightDecorations = (
  highlightRanges: EditorHighlightRange[],
  docLength: number,
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of highlightRanges) {
    if (range.type === 'added') {
      const validRange = getValidTextRange({
        from: range.from,
        to: range.to,
        docLength,
      });

      if (!validRange) {
        continue;
      }

      decorations.push(
        Decoration.mark({ class: 'byline-added-text' }).range(
          validRange.from,
          validRange.to,
        ),
      );
      continue;
    }

    const validRange = getValidTextRange({
      from: range.from,
      to: range.from,
      docLength,
      allowEmpty: true,
    });

    if (!validRange) {
      continue;
    }

    decorations.push(
      Decoration.widget({
        widget: new DeletedMarkerWidget(),
        side: -1,
      }).range(validRange.from),
    );
  }

  return decorations;
};

const getDraftHighlightDecorations = (
  draftHighlightRanges: DraftHighlightRange[],
  docLength: number,
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of draftHighlightRanges) {
    const validRange = getValidTextRange({
      from: range.from,
      to: range.to,
      docLength,
    });

    if (!validRange) {
      continue;
    }

    decorations.push(
      Decoration.mark({ class: 'byline-deleted-text' }).range(
        validRange.from,
        validRange.to,
      ),
    );
  }

  return decorations;
};

const getEditorLineDecorations = (
  editorView: EditorView,
  editorLineDecorations: EditorLineDecoration[],
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const decoration of editorLineDecorations) {
    if (
      decoration.lineNumber < 1 ||
      decoration.lineNumber > editorView.state.doc.lines
    ) {
      continue;
    }

    const line = editorView.state.doc.line(decoration.lineNumber);
    decorations.push(Decoration.line({ class: 'byline-added-line' }).range(line.from));
  }

  return decorations;
};

const getDraftLineDecorations = (
  editorView: EditorView,
  draftLineDecorations: DraftLineDecoration[],
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const decoration of draftLineDecorations) {
    if (
      decoration.lineNumber < 1 ||
      decoration.lineNumber > editorView.state.doc.lines
    ) {
      continue;
    }

    const line = editorView.state.doc.line(decoration.lineNumber);

    if (decoration.type === 'deletedDraftLine') {
      decorations.push(
        Decoration.line({ class: 'byline-deleted-draft-line' }).range(line.from),
      );
      continue;
    }

    const position = decoration.placement === 'after' ? line.to : line.from;
    const side = decoration.placement === 'after' ? 1 : -1;

    decorations.push(
      Decoration.widget({
        block: true,
        side,
        widget: new MissingLineWidget(decoration.lineCount),
      }).range(position),
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
