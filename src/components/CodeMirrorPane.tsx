import { useEffect, useRef } from 'react';

import { EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
  getCodeMirrorDecorations,
  getCodeMirrorDecorationsInput,
  setEditorDecorationsEffect,
} from '../editor/codeMirrorDecorations';
import type { RunConsoleCommand } from '../editor/codeMirrorConsoleCommands';
import {
  getDiffPaintEffectValue,
  getTypingDiffDecorations,
  setDiffPaintEffect,
  setTypingDiffDecorationsEffect,
} from '../editor/codeMirrorDiffPaint';
import { getCodeMirrorExtensions } from '../editor/codeMirrorExtensions';
import { setCodeMirrorFontStyleRangesEffect } from '../editor/codeMirrorFontStyleHistory';
import {
  getCodeMirrorPaneLineNumberClassName,
  getLineNumberEdgeTriggerClassName,
} from '../editor/codeMirrorLineNumberSettings';
import { getLineNumberReconfigureEffects } from '../editor/codeMirrorLineCopy';
import { scrollToLineNumber } from '../editor/codeMirrorScroll';
import type {
  CodeMirrorTheme,
  CopyLineHandler,
  FontSizeMode,
  LineNumberPosition,
  LineNumberVisibilityMode,
  ScrollOffset,
} from '../appTypes';
import type {
  DraftHighlightRange,
  DraftLineDecoration,
  EditorHighlightRange,
  EditorLineDecoration,
  LowestEditedLine,
} from '../editorDiff';
import type {
  FontStyleRange,
  FontStyleType,
  StyledDocumentChange,
  TextSelectionRange,
} from '../fontStyles';
import { areFontStyleRangesEqual } from '../fontStyles';
import { shouldRevealAutoHiddenControls } from '../pointerEvents';

type CodeMirrorPaneProps = {
  value: string;
  onDocumentChange: (change: StyledDocumentChange) => void;
  onCommittedValueChange: (value: string) => void;
  onTypingActivity?: () => void;
  onFocusPane?: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onRunConsoleCommand: RunConsoleCommand;
  onCopyLine: CopyLineHandler;
  lineNumberPosition: LineNumberPosition;
  lineNumberVisibilityMode: LineNumberVisibilityMode;
  areLineNumbersVisible: boolean;
  onShowLineNumbers: () => void;
  onScheduleLineNumbersHide: () => void;
  fontSizeMode: FontSizeMode;
  ariaLabel: string;
  theme: CodeMirrorTheme;
  initialLineNumber: number;
  savedScrollOffset: ScrollOffset;
  onScrollOffsetChange: (
    scrollOffset: ScrollOffset,
    topVisibleLineNumber: number,
  ) => void;
  onContentLayoutChange?: () => void;
  onSelectionChange?: (selections: TextSelectionRange[]) => void;
  activeFontStyleTypes: FontStyleType[];
  editorHighlightRanges?: EditorHighlightRange[];
  draftHighlightRanges?: DraftHighlightRange[];
  editorLineDecorations?: EditorLineDecoration[];
  draftLineDecorations?: DraftLineDecoration[];
  fontStyleRanges?: FontStyleRange[];
  lowestEditedLine?: LowestEditedLine | null;
  onEditorViewChange?: (editorView: EditorView | null) => void;
};

const DOCUMENT_VALUE_COMMIT_DELAY_MS = 180;

export const CodeMirrorPane = ({
  value,
  onDocumentChange,
  onCommittedValueChange,
  onTypingActivity,
  onFocusPane,
  onToggleFontStyle,
  onRunConsoleCommand,
  onCopyLine,
  lineNumberPosition,
  lineNumberVisibilityMode,
  areLineNumbersVisible,
  onShowLineNumbers,
  onScheduleLineNumbersHide,
  fontSizeMode,
  ariaLabel,
  theme,
  initialLineNumber,
  savedScrollOffset,
  onScrollOffsetChange,
  onContentLayoutChange,
  onSelectionChange,
  activeFontStyleTypes,
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
  const onCommittedValueChangeRef = useRef(onCommittedValueChange);
  const onTypingActivityRef = useRef(onTypingActivity);
  const onScrollOffsetChangeRef = useRef(onScrollOffsetChange);
  const onContentLayoutChangeRef = useRef(onContentLayoutChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onEditorViewChangeRef = useRef(onEditorViewChange);
  const onFocusPaneRef = useRef(onFocusPane);
  const onToggleFontStyleRef = useRef(onToggleFontStyle);
  const onRunConsoleCommandRef = useRef(onRunConsoleCommand);
  const onCopyLineRef = useRef(onCopyLine);
  const activeFontStyleTypesRef = useRef(activeFontStyleTypes);
  const lineNumberVisibilityModeRef = useRef(lineNumberVisibilityMode);
  const onShowLineNumbersRef = useRef(onShowLineNumbers);
  const onScheduleLineNumbersHideRef = useRef(onScheduleLineNumbersHide);
  const lineNumberPositionRef = useRef(lineNumberPosition);
  const fontStyleRangesRef = useRef(fontStyleRanges ?? []);
  const lastAppliedFontStyleRangesRef = useRef(fontStyleRanges ?? []);
  const areLineNumbersVisibleRef = useRef(true);
  const initialValueRef = useRef(value);
  const lastCommittedValueRef = useRef(value);
  const isApplyingExternalValueRef = useRef(false);
  const valueCommitTimeoutRef = useRef<number | null>(null);
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
    onCommittedValueChangeRef.current = onCommittedValueChange;
  }, [onCommittedValueChange]);

  useEffect(() => {
    onTypingActivityRef.current = onTypingActivity;
  }, [onTypingActivity]);

  useEffect(() => {
    onScrollOffsetChangeRef.current = onScrollOffsetChange;
  }, [onScrollOffsetChange]);

  useEffect(() => {
    onContentLayoutChangeRef.current = onContentLayoutChange;
  }, [onContentLayoutChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

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
    onRunConsoleCommandRef.current = onRunConsoleCommand;
  }, [onRunConsoleCommand]);

  useEffect(() => {
    onCopyLineRef.current = onCopyLine;
  }, [onCopyLine]);

  useEffect(() => {
    activeFontStyleTypesRef.current = activeFontStyleTypes;
  }, [activeFontStyleTypes]);

  useEffect(() => {
    lineNumberVisibilityModeRef.current = lineNumberVisibilityMode;
  }, [lineNumberVisibilityMode]);

  useEffect(() => {
    onShowLineNumbersRef.current = onShowLineNumbers;
  }, [onShowLineNumbers]);

  useEffect(() => {
    onScheduleLineNumbersHideRef.current = onScheduleLineNumbersHide;
  }, [onScheduleLineNumbersHide]);

  useEffect(() => {
    const nextFontStyleRanges = fontStyleRanges ?? [];
    fontStyleRangesRef.current = nextFontStyleRanges;

    const editorView = editorViewRef.current;

    if (
      areFontStyleRangesEqual(
        lastAppliedFontStyleRangesRef.current,
        nextFontStyleRanges,
      )
    ) {
      return;
    }

    lastAppliedFontStyleRangesRef.current = nextFontStyleRanges;

    if (!editorView) {
      return;
    }

    editorView.dispatch({
      effects: [setCodeMirrorFontStyleRangesEffect.of(nextFontStyleRanges)],
      annotations: [Transaction.addToHistory.of(false)],
    });
  }, [fontStyleRanges]);

  useEffect(() => {
    lineNumberPositionRef.current = lineNumberPosition;
  }, [lineNumberPosition]);

  useEffect(() => {
    areLineNumbersVisibleRef.current = areLineNumbersVisible;
  }, [areLineNumbersVisible]);

  const isInsideLineNumberGutter = (target: EventTarget | null): boolean => {
    return (
      target instanceof HTMLElement &&
      target.closest('.cm-gutters') !== null
    );
  };

  const refreshEditorGeometry = (editorView: EditorView) => {
    const diffPaintEffectValue = getDiffPaintEffectValue(decorationsRef.current);

    editorView.requestMeasure();

    editorView.dispatch({
      effects: [
        setEditorDecorationsEffect.of(
          getCodeMirrorDecorations(editorView, decorationsRef.current),
        ),
        setDiffPaintEffect.of(diffPaintEffectValue),
        setTypingDiffDecorationsEffect.of(
          getTypingDiffDecorations({
            theme,
            docLength: editorView.state.doc.length,
            diffPaint: diffPaintEffectValue,
          }),
        ),
      ],
    });

    editorView.requestMeasure();
  };

  const clearValueCommitTimeout = () => {
    if (valueCommitTimeoutRef.current !== null) {
      window.clearTimeout(valueCommitTimeoutRef.current);
      valueCommitTimeoutRef.current = null;
    }
  };

  const getCurrentEditorValue = (): string => {
    const editorView = editorViewRef.current;
    return editorView ? editorView.state.doc.toString() : lastCommittedValueRef.current;
  };

  const commitCurrentEditorValue = () => {
    clearValueCommitTimeout();

    const nextValue = getCurrentEditorValue();
    if (nextValue === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = nextValue;
    onCommittedValueChangeRef.current(nextValue);
  };

  const scheduleCurrentEditorValueCommit = () => {
    clearValueCommitTimeout();
    valueCommitTimeoutRef.current = window.setTimeout(() => {
      valueCommitTimeoutRef.current = null;
      commitCurrentEditorValue();
    }, DOCUMENT_VALUE_COMMIT_DELAY_MS);
  };

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

    refreshEditorGeometry(editorView);
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
          pane: theme,
          theme,
          onRunConsoleCommand: (command, context) =>
            onRunConsoleCommandRef.current(command, context),
          onDocumentChange: (change) => {
            fontStyleRangesRef.current = change.fontStyleRanges;
            lastAppliedFontStyleRangesRef.current = change.fontStyleRanges;
            onTypingActivityRef.current?.();

            if (!isApplyingExternalValueRef.current) {
              scheduleCurrentEditorValueCommit();
            }

            onDocumentChangeRef.current(change);
          },
          onFocusPane: () => onFocusPaneRef.current?.(),
          onToggleFontStyle: (fontStyleType) =>
            onToggleFontStyleRef.current(fontStyleType),
          onScroll: (nextScrollOffset, topVisibleLineNumber) =>
            onScrollOffsetChangeRef.current(nextScrollOffset, topVisibleLineNumber),
          onContentLayoutChange: () => onContentLayoutChangeRef.current?.(),
          onSelectionChange: (selections) =>
            onSelectionChangeRef.current?.(selections),
          onCopyLine: (context) => onCopyLineRef.current(context),
          getInitialFontStyleRanges: () => fontStyleRanges ?? [],
          getFontStyleRanges: () => fontStyleRangesRef.current,
          getActiveFontStyleTypes: () => activeFontStyleTypesRef.current,
          lineNumberPosition: lineNumberPositionRef.current,
          lineNumberVisibilityMode: lineNumberVisibilityModeRef.current,
          areLineNumbersVisible: areLineNumbersVisibleRef.current,
        }),
      }),
    });

    editorViewRef.current = editorView;
    onEditorViewChangeRef.current?.(editorView);
    editorView.scrollDOM.scrollLeft = initialScrollOffsetRef.current.left;
    scrollToLineNumber(editorView, initialLineNumberRef.current);
    const diffPaintEffectValue = getDiffPaintEffectValue(decorationsRef.current);
    editorView.dispatch({
      effects: [
        setEditorDecorationsEffect.of(
          getCodeMirrorDecorations(editorView, decorationsRef.current),
        ),
        setDiffPaintEffect.of(diffPaintEffectValue),
        setTypingDiffDecorationsEffect.of(
          getTypingDiffDecorations({
            theme,
            docLength: editorView.state.doc.length,
            diffPaint: diffPaintEffectValue,
          }),
        ),
      ],
    });

    return () => {
      commitCurrentEditorValue();
      clearValueCommitTimeout();
      onSelectionChangeRef.current?.([]);
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

    if (value === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = value;

    const currentValue = editorView.state.doc.toString();

    if (currentValue === value) {
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
    } finally {
      isApplyingExternalValueRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }

    editorView.dispatch({
      effects: getLineNumberReconfigureEffects({
        position: lineNumberPosition,
        visibilityMode: lineNumberVisibilityMode,
        isVisible: areLineNumbersVisible,
        pane: theme,
        onCopyLine: (context) => onCopyLineRef.current(context),
      }),
    });
    editorView.requestMeasure();
  }, [lineNumberPosition, lineNumberVisibilityMode, areLineNumbersVisible, theme]);

  useEffect(() => {
    const editorView = editorViewRef.current;

    if (!editorView) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      refreshEditorGeometry(editorView);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [fontSizeMode]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${getCodeMirrorPaneLineNumberClassName({
        position: lineNumberPosition,
        visibilityMode: lineNumberVisibilityMode,
        isVisible: areLineNumbersVisible,
      })}`}
      onPointerOver={(event) => {
        if (lineNumberVisibilityMode !== 'autoHide') {
          return;
        }

        if (!shouldRevealAutoHiddenControls(event.pointerType)) {
          return;
        }

        if (!isInsideLineNumberGutter(event.target)) {
          return;
        }

        onShowLineNumbersRef.current();
      }}
      onPointerOut={(event) => {
        if (lineNumberVisibilityMode !== 'autoHide') {
          return;
        }

        if (!isInsideLineNumberGutter(event.target)) {
          return;
        }

        if (isInsideLineNumberGutter(event.relatedTarget)) {
          return;
        }

        onScheduleLineNumbersHideRef.current();
      }}
      onPointerLeave={() => {
        if (lineNumberVisibilityMode === 'autoHide') {
          onScheduleLineNumbersHideRef.current();
        }
      }}
    >
      {lineNumberVisibilityMode === 'autoHide' && !areLineNumbersVisible && (
        <div
          aria-hidden="true"
          onPointerEnter={(event) => {
            if (!shouldRevealAutoHiddenControls(event.pointerType)) {
              return;
            }

            onShowLineNumbersRef.current();
          }}
          className={getLineNumberEdgeTriggerClassName({
            position: lineNumberPosition,
          })}
        />
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};
