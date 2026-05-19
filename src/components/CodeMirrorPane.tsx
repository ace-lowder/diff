import { useEffect, useRef } from 'react';

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
  getCodeMirrorDecorations,
  getCodeMirrorDecorationsInput,
  setEditorDecorationsEffect,
} from '../editor/codeMirrorDecorations';
import { getCodeMirrorExtensions } from '../editor/codeMirrorExtensions';
import { scrollToLineNumber } from '../editor/codeMirrorScroll';
import type { CodeMirrorTheme, ScrollOffset } from '../appTypes';
import type {
  DraftHighlightRange,
  DraftLineDecoration,
  EditorHighlightRange,
  EditorLineDecoration,
  LowestEditedLine,
} from '../editorDiff';
import type { FontStyleRange, FontStyleType, TextChange } from '../fontStyles';

type CodeMirrorPaneProps = {
  value: string;
  onDocumentChange: ({
    value,
    changes,
  }: {
    value: string;
    changes: TextChange[];
  }) => void;
  onFocusPane?: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  ariaLabel: string;
  theme: CodeMirrorTheme;
  initialLineNumber: number;
  savedScrollOffset: ScrollOffset;
  onScrollOffsetChange: (
    scrollOffset: ScrollOffset,
    topVisibleLineNumber: number,
  ) => void;
  editorHighlightRanges?: EditorHighlightRange[];
  draftHighlightRanges?: DraftHighlightRange[];
  editorLineDecorations?: EditorLineDecoration[];
  draftLineDecorations?: DraftLineDecoration[];
  fontStyleRanges?: FontStyleRange[];
  lowestEditedLine?: LowestEditedLine | null;
  onEditorViewChange?: (editorView: EditorView | null) => void;
};

export const CodeMirrorPane = ({
  value,
  onDocumentChange,
  onFocusPane,
  onToggleFontStyle,
  ariaLabel,
  theme,
  initialLineNumber,
  savedScrollOffset,
  onScrollOffsetChange,
  editorHighlightRanges,
  draftHighlightRanges,
  editorLineDecorations,
  draftLineDecorations,
  fontStyleRanges,
  lowestEditedLine,
  onEditorViewChange,
}: CodeMirrorPaneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onScrollOffsetChangeRef = useRef(onScrollOffsetChange);
  const onEditorViewChangeRef = useRef(onEditorViewChange);
  const onFocusPaneRef = useRef(onFocusPane);
  const onToggleFontStyleRef = useRef(onToggleFontStyle);
  const initialValueRef = useRef(value);
  const lastPropValueRef = useRef(value);
  const lastLocalValueRef = useRef(value);
  const isApplyingExternalValueRef = useRef(false);
  const initialLineNumberRef = useRef(initialLineNumber);
  const initialScrollOffsetRef = useRef(savedScrollOffset);
  const decorationsRef = useRef(
    getCodeMirrorDecorationsInput({
      editorHighlightRanges,
      draftHighlightRanges,
      editorLineDecorations,
      draftLineDecorations,
      fontStyleRanges,
      lowestEditedLine,
    }),
  );

  useEffect(() => {
    onDocumentChangeRef.current = onDocumentChange;
  }, [onDocumentChange]);

  useEffect(() => {
    onScrollOffsetChangeRef.current = onScrollOffsetChange;
  }, [onScrollOffsetChange]);

  useEffect(() => {
    onEditorViewChangeRef.current = onEditorViewChange;
  }, [onEditorViewChange]);

  useEffect(() => {
    onFocusPaneRef.current = onFocusPane;
  }, [onFocusPane]);

  useEffect(() => {
    onToggleFontStyleRef.current = onToggleFontStyle;
  }, [onToggleFontStyle]);

  useEffect(() => {
    decorationsRef.current = getCodeMirrorDecorationsInput({
      editorHighlightRanges,
      draftHighlightRanges,
      editorLineDecorations,
      draftLineDecorations,
      fontStyleRanges,
      lowestEditedLine,
    });

    const editorView = editorViewRef.current;

    if (!editorView) {
      return;
    }

    editorView.dispatch({
      effects: setEditorDecorationsEffect.of(
        getCodeMirrorDecorations(editorView, decorationsRef.current),
      ),
    });
  }, [
    draftHighlightRanges,
    draftLineDecorations,
    editorHighlightRanges,
    editorLineDecorations,
    fontStyleRanges,
    lowestEditedLine,
  ]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const editorView = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: getCodeMirrorExtensions({
          ariaLabel,
          theme,
          onDocumentChange: ({ value: nextValue, changes }) => {
            if (!isApplyingExternalValueRef.current) {
              lastLocalValueRef.current = nextValue;
            }

            onDocumentChangeRef.current({ value: nextValue, changes });
          },
          onFocusPane: () => onFocusPaneRef.current?.(),
          onToggleFontStyle: (fontStyleType) =>
            onToggleFontStyleRef.current(fontStyleType),
          onScroll: (nextScrollOffset, topVisibleLineNumber) =>
            onScrollOffsetChangeRef.current(nextScrollOffset, topVisibleLineNumber),
        }),
      }),
    });

    editorViewRef.current = editorView;
    onEditorViewChangeRef.current?.(editorView);
    editorView.scrollDOM.scrollLeft = initialScrollOffsetRef.current.left;
    scrollToLineNumber(editorView, initialLineNumberRef.current);
    editorView.dispatch({
      effects: setEditorDecorationsEffect.of(
        getCodeMirrorDecorations(editorView, decorationsRef.current),
      ),
    });

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
      onEditorViewChangeRef.current?.(null);
    };
  }, [ariaLabel, theme]);

  useEffect(() => {
    const editorView = editorViewRef.current;

    if (!editorView) {
      return;
    }

    const previousPropValue = lastPropValueRef.current;
    lastPropValueRef.current = value;

    const currentValue = editorView.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    if (lastLocalValueRef.current === value) {
      return;
    }

    const hasUncommittedLocalEdit =
      value === previousPropValue && currentValue === lastLocalValueRef.current;

    if (hasUncommittedLocalEdit) {
      return;
    }

    isApplyingExternalValueRef.current = true;

    try {
      editorView.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      lastLocalValueRef.current = value;
    } finally {
      isApplyingExternalValueRef.current = false;
    }
  }, [value]);

  return <div ref={containerRef} className="h-full w-full" />;
};
