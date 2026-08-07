import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';

import {
  clampLineNumber,
  getTopVisibleLineNumber,
  scrollToLineNumber,
} from './codeMirrorScroll';

const createEditorView = () => {
  const state = EditorState.create({
    doc: ['First line.', 'A long second line that wraps.', 'Third line.'].join('\n'),
  });
  const scrollDOM = { scrollTop: 72 };
  const lineBlockAtHeight = vi.fn(() => ({
    from: state.doc.line(2).from + 12,
  }));
  const lineBlockAt = vi.fn((position: number) => ({
    top: state.doc.lineAt(position).number * 48,
  }));
  const editorView = {
    state,
    scrollDOM,
    lineBlockAtHeight,
    lineBlockAt,
  } as unknown as EditorView;

  return { editorView, lineBlockAt, lineBlockAtHeight, scrollDOM, state };
};

describe('CodeMirror scrolling', () => {
  it('resolves a wrapped visual block to its document line', () => {
    const { editorView, lineBlockAtHeight, scrollDOM } = createEditorView();

    expect(getTopVisibleLineNumber(editorView)).toBe(2);
    expect(lineBlockAtHeight).toHaveBeenCalledWith(scrollDOM.scrollTop);
  });

  it('scrolls to the requested document line geometry', () => {
    const { editorView, lineBlockAt, scrollDOM, state } = createEditorView();

    scrollToLineNumber(editorView, 3);

    expect(lineBlockAt).toHaveBeenCalledWith(state.doc.line(3).from);
    expect(scrollDOM.scrollTop).toBe(144);
  });

  it('clamps scroll targets to the available document lines', () => {
    const { editorView } = createEditorView();

    expect(clampLineNumber(-4, editorView)).toBe(1);
    expect(clampLineNumber(99, editorView)).toBe(3);
  });
});
