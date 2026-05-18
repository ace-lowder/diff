import { EditorView } from '@codemirror/view';

export const getTopVisibleLineNumber = (editorView: EditorView): number => {
  const topBlock = editorView.lineBlockAtHeight(editorView.scrollDOM.scrollTop);
  return editorView.state.doc.lineAt(topBlock.from).number;
};

export const clampLineNumber = (
  lineNumber: number,
  editorView: EditorView,
): number => {
  return Math.min(Math.max(1, lineNumber), editorView.state.doc.lines);
};

export const scrollToLineNumber = (
  editorView: EditorView,
  lineNumber: number,
): void => {
  const clampedLineNumber = clampLineNumber(lineNumber, editorView);
  const line = editorView.state.doc.line(clampedLineNumber);
  const block = editorView.lineBlockAt(line.from);
  editorView.scrollDOM.scrollTop = block.top;
};
