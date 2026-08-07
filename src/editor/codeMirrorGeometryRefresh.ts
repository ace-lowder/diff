import type { EditorView } from '@codemirror/view';

import type { CodeMirrorTheme } from '../appTypes';
import {
  getCodeMirrorDecorations,
  setEditorDecorationsEffect,
  type CodeMirrorDecorations,
} from './codeMirrorDecorations';
import {
  getDiffPaintEffectValue,
  getTypingDiffDecorations,
  setDiffPaintEffect,
  setTypingDiffDecorationsEffect,
} from './codeMirrorDiffPaint';

export const refreshCodeMirrorGeometry = ({
  editorView,
  decorations,
  theme,
}: {
  editorView: EditorView;
  decorations: CodeMirrorDecorations;
  theme: CodeMirrorTheme;
}) => {
  const diffPaint = getDiffPaintEffectValue(decorations);

  editorView.requestMeasure();
  editorView.dispatch({
    effects: [
      setEditorDecorationsEffect.of(
        getCodeMirrorDecorations(editorView, decorations),
      ),
      setDiffPaintEffect.of(diffPaint),
      setTypingDiffDecorationsEffect.of(
        getTypingDiffDecorations({
          theme,
          docLength: editorView.state.doc.length,
          diffPaint,
        }),
      ),
    ],
  });
  editorView.requestMeasure();
};
