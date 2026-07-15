import { describe, expect, it } from 'vitest';

import { history, redo, undo } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';

import {
  createCodeMirrorFontStyleHistoryExtension,
  codeMirrorRichPasteFontStyleRangesAnnotation,
  setCodeMirrorFontStyleRangesEffect,
} from './codeMirrorFontStyleHistory';
import type { FontStyleRange } from '../fontStyles';

const createState = (fontStyleRanges: FontStyleRange[]) => {
  const historyExtension = createCodeMirrorFontStyleHistoryExtension({
    getInitialFontStyleRanges: () => fontStyleRanges,
    getActiveFontStyleTypes: () => [],
  });

  let state = EditorState.create({
    doc: 'abcde',
    extensions: [history(), ...historyExtension.extension],
  });

  return {
    get state() {
      return state;
    },
    dispatch(transaction: { state: EditorState }) {
      state = transaction.state;
    },
    field: historyExtension.field,
  };
};

describe('codeMirrorFontStyleHistory', () => {
  it('restores exact styled ranges through undo and redo', () => {
    const editor = createState([
      { type: 'bold', from: 1, to: 4 },
      { type: 'italic', from: 1, to: 4 },
      { type: 'underline', from: 1, to: 4 },
    ]);

    editor.dispatch(
      editor.state.update({
        changes: {
          from: 1,
          to: 4,
          insert: '',
        },
      }),
    );

    expect(editor.state.doc.toString()).toBe('ae');
    expect(editor.state.field(editor.field)).toEqual([]);

    expect(undo(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe('abcde');
    expect(editor.state.field(editor.field)).toEqual([
      { type: 'bold', from: 1, to: 4 },
      { type: 'italic', from: 1, to: 4 },
      { type: 'underline', from: 1, to: 4 },
    ]);

    expect(redo(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe('ae');
    expect(editor.state.field(editor.field)).toEqual([]);
  });

  it('accepts explicit font-style restore effects', () => {
    const editor = createState([]);

    editor.dispatch(
      editor.state.update({
        effects: setCodeMirrorFontStyleRangesEffect.of([
          { type: 'bold', from: 0, to: 2 },
        ]),
      }),
    );

    expect(editor.state.field(editor.field)).toEqual([
      { type: 'bold', from: 0, to: 2 },
    ]);
  });

  it('uses the rich-paste annotation when computing inserted styles', () => {
    const editor = createState([]);

    editor.dispatch(
      editor.state.update({
        changes: {
          from: 1,
          to: 1,
          insert: 'xy',
        },
        annotations: [
          codeMirrorRichPasteFontStyleRangesAnnotation.of([
            { type: 'underline', from: 1, to: 3 },
          ]),
        ],
      }),
    );

    expect(editor.state.doc.toString()).toBe('axybcde');
    expect(editor.state.field(editor.field)).toEqual([
      { type: 'underline', from: 1, to: 3 },
    ]);
  });
});
