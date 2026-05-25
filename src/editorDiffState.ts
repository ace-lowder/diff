import {
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
  type DisplayChange,
  type DraftHighlightRange,
  type DraftLineDecoration,
  type EditorHighlightRange,
  type EditorLineDecoration,
  type EditorStats,
  type LowestEditedLine,
} from './editorDiff';

export type EditorDiffState = {
  displayChanges: DisplayChange[];
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  lineDecorations: {
    editorLineDecorations: EditorLineDecoration[];
    draftLineDecorations: DraftLineDecoration[];
  };
  lowestEditedLine: LowestEditedLine | null;
  editorStats: EditorStats;
};

export const getEditorDiffState = ({
  draftText,
  editorText,
}: {
  draftText: string;
  editorText: string;
}): EditorDiffState => {
  const displayChanges = getDisplayChanges(draftText, editorText);

  return {
    displayChanges,
    editorHighlightRanges: getEditorHighlightRanges(displayChanges),
    draftHighlightRanges: getDraftHighlightRanges(displayChanges),
    lineDecorations: getLineDecorations(draftText, editorText),
    lowestEditedLine: getLowestEditedLine(displayChanges),
    editorStats: getEditorStats(editorText, displayChanges),
  };
};
