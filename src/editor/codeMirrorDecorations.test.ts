import { EditorState } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

import {
  editorDecorationsField,
  setEditorDecorationsEffect,
} from './codeMirrorDecorations';

describe('editorDecorationsField', () => {
  it('maps decorations through document inserts', () => {
    const initialDecorationSet = Decoration.set([
      Decoration.mark({ class: 'test-mark' }).range(1, 3),
    ]);

    const initialState = EditorState.create({
      doc: 'abcd',
      extensions: [editorDecorationsField],
    });

    const seededState = initialState.update({
      effects: [setEditorDecorationsEffect.of(initialDecorationSet)],
    }).state;

    const updatedState = seededState.update({
      changes: { from: 0, insert: 'z' },
    }).state;

    const ranges: Array<{ from: number; to: number }> = [];
    updatedState.field(editorDecorationsField).between(0, updatedState.doc.length, (from, to) => {
      ranges.push({ from, to });
    });

    expect(ranges).toEqual([{ from: 2, to: 4 }]);
  });
});
