import {
  getLineAnchoredDiffResult,
  type DraftHighlightRange,
  type DraftLineDecoration,
  type EditorHighlightRange,
  type EditorLineDecoration,
  type EditorStats,
  type LowestEditedLine,
} from './editorDiff';

export type EditorDiffState = {
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
  return getLineAnchoredDiffResult({ draftText, editorText });
};
