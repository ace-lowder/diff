import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Range,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  Decoration,
  EditorView,
  WidgetType,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type KeyBinding,
  type DecorationSet,
} from '@codemirror/view';

import {
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
  getWordCount,
  type DraftLineDecoration,
  type DraftHighlightRange,
  type EditorHighlightRange,
  type EditorLineDecoration,
  type LowestEditedLine,
  type EditorStats,
  type StatsMode,
} from './editorDiff';
import {
  getClipboardHtml,
  getDraftClipboardHighlightRanges,
  type ClipboardFontStyleRange,
  type ClipboardHighlightRange,
} from './clipboardExport';
import {
  getInsertedFontStyleRanges,
  mapFontStyleRangesThroughChanges,
  normalizeFontStyleRanges,
  toggleFontStyleRanges,
  type FontStyleRange,
  type FontStyleType,
  type TextChange,
  type TextSelectionRange,
} from './fontStyles';

const App = () => {
  const [mode, setMode] = useState<AppMode>('split');
  const [statsMode, setStatsMode] = useState<StatsMode>('words');
  const [draftText, setDraftText] = useState(() =>
    getStoredText(storageKeys.draftText),
  );
  const [editorText, setEditorText] = useState(() =>
    getStoredText(storageKeys.editorText),
  );
  const [draftFontStyleRanges, setDraftFontStyleRanges] = useState<FontStyleRange[]>(
    () => getStoredFontStyleRanges(storageKeys.draftFontStyleRanges),
  );
  const [editorFontStyleRanges, setEditorFontStyleRanges] = useState<FontStyleRange[]>(
    () => getStoredFontStyleRanges(storageKeys.editorFontStyleRanges),
  );
  const [draftActiveFontStyleTypes, setDraftActiveFontStyleTypes] = useState<
    FontStyleType[]
  >([]);
  const [editorActiveFontStyleTypes, setEditorActiveFontStyleTypes] = useState<
    FontStyleType[]
  >([]);
  const [activePane, setActivePane] = useState<PaneId>('editor');
  const [draftScrollOffset, setDraftScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });
  const [editorScrollOffset, setEditorScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });
  const [initialLineNumber, setInitialLineNumber] = useState(1);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [coffeeStatus, setCoffeeStatus] = useState<CoffeeStatus>('idle');
  const draftEditorViewRef = useRef<EditorView | null>(null);
  const editorEditorViewRef = useRef<EditorView | null>(null);
  const suppressedScrollPaneRef = useRef<PaneId | null>(null);
  const activeLineNumberRef = useRef(1);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const pendingScrollSourcePaneRef = useRef<PaneId | null>(null);
  const copyStatusTimeoutRef = useRef<number | null>(null);
  const coffeeStatusTimeoutRef = useRef<number | null>(null);
  const draftActiveFontStyleTypesRef = useRef<FontStyleType[]>([]);
  const editorActiveFontStyleTypesRef = useRef<FontStyleType[]>([]);

  const displayChanges = useMemo(() => {
    return getDisplayChanges(draftText, editorText);
  }, [draftText, editorText]);

  const editorHighlightRanges = useMemo(() => {
    return getEditorHighlightRanges(displayChanges);
  }, [displayChanges]);

  const draftHighlightRanges = useMemo(() => {
    return getDraftHighlightRanges(displayChanges);
  }, [displayChanges]);

  const lineDecorations = useMemo(() => {
    return getLineDecorations(draftText, editorText);
  }, [draftText, editorText]);

  const lowestEditedLine = useMemo(() => {
    return getLowestEditedLine(displayChanges);
  }, [displayChanges]);

  const editorStats = useMemo(() => {
    return getEditorStats(editorText, displayChanges);
  }, [editorText, displayChanges]);

  useEffect(() => {
    setStoredText(storageKeys.draftText, draftText);
  }, [draftText]);

  useEffect(() => {
    setStoredText(storageKeys.editorText, editorText);
  }, [editorText]);

  useEffect(() => {
    setStoredFontStyleRanges(storageKeys.draftFontStyleRanges, draftFontStyleRanges);
  }, [draftFontStyleRanges]);

  useEffect(() => {
    setStoredFontStyleRanges(storageKeys.editorFontStyleRanges, editorFontStyleRanges);
  }, [editorFontStyleRanges]);

  useEffect(() => {
    draftActiveFontStyleTypesRef.current = draftActiveFontStyleTypes;
  }, [draftActiveFontStyleTypes]);

  useEffect(() => {
    editorActiveFontStyleTypesRef.current = editorActiveFontStyleTypes;
  }, [editorActiveFontStyleTypes]);

  useEffect(() => {
    return () => {
      if (scrollSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSyncFrameRef.current);
      }
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current);
      }
      if (coffeeStatusTimeoutRef.current !== null) {
        window.clearTimeout(coffeeStatusTimeoutRef.current);
      }
    };
  }, []);

  const refreshActiveLineFromVisiblePane = () => {
    if (mode === 'draft') {
      if (draftEditorViewRef.current) {
        activeLineNumberRef.current = getTopVisibleLineNumber(draftEditorViewRef.current);
      }
      return;
    }

    if (mode === 'editor') {
      if (editorEditorViewRef.current) {
        activeLineNumberRef.current = getTopVisibleLineNumber(editorEditorViewRef.current);
      }
      return;
    }

    if (draftEditorViewRef.current) {
      activeLineNumberRef.current = getTopVisibleLineNumber(draftEditorViewRef.current);
    }
  };

  const handleModeToggle = () => {
    refreshActiveLineFromVisiblePane();
    setInitialLineNumber(activeLineNumberRef.current);
    setMode((currentMode) => getNextMode(currentMode));
  };

  const handleStatsModeToggle = () => {
    setStatsMode((currentStatsMode) => getNextStatsMode(currentStatsMode));
  };

  const handleCopyText = async () => {
    const copyText = mode === 'draft' ? draftText : editorText;
    const clipboardHighlightRanges: ClipboardHighlightRange[] =
      mode === 'draft'
        ? getDraftClipboardHighlightRanges({
            text: draftText,
            highlightRanges: draftHighlightRanges.map((range) => ({
              type: 'deleted',
              from: range.from,
              to: range.to,
            })),
          })
        : editorHighlightRanges;
    const fontStyleRanges: ClipboardFontStyleRange[] =
      mode === 'draft' ? draftFontStyleRanges : editorFontStyleRanges;

    try {
      const htmlText = getClipboardHtml({
        text: copyText,
        highlightRanges: clipboardHighlightRanges,
        fontStyleRanges,
      });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([copyText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
        }),
      ]);

      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }

    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
    }

    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle');
      copyStatusTimeoutRef.current = null;
    }, 1500);
  };

  const handleCoffeeClick = () => {
    setCoffeeStatus('clicked');

    if (coffeeStatusTimeoutRef.current !== null) {
      window.clearTimeout(coffeeStatusTimeoutRef.current);
    }

    coffeeStatusTimeoutRef.current = window.setTimeout(() => {
      setCoffeeStatus('idle');
      coffeeStatusTimeoutRef.current = null;
    }, 1500);
  };

  const runSplitScrollSync = () => {
    scrollSyncFrameRef.current = null;
    const sourcePane = pendingScrollSourcePaneRef.current;
    pendingScrollSourcePaneRef.current = null;

    if (!sourcePane || mode !== 'split') {
      return;
    }

    if (suppressedScrollPaneRef.current === sourcePane) {
      suppressedScrollPaneRef.current = null;
      return;
    }

    const sourceView =
      sourcePane === 'draft' ? draftEditorViewRef.current : editorEditorViewRef.current;
    const targetPane: PaneId = sourcePane === 'draft' ? 'editor' : 'draft';
    const targetView =
      targetPane === 'draft' ? draftEditorViewRef.current : editorEditorViewRef.current;

    if (!sourceView || !targetView) {
      return;
    }

    const sourceTopLineNumber = getTopVisibleLineNumber(sourceView);
    const targetLineNumber = clampLineNumber(sourceTopLineNumber, targetView);
    const currentTargetTopLineNumber = getTopVisibleLineNumber(targetView);

    if (currentTargetTopLineNumber === targetLineNumber) {
      return;
    }

    suppressedScrollPaneRef.current = targetPane;
    scrollToLineNumber(targetView, targetLineNumber);
  };

  const syncSplitScroll = (sourcePane: PaneId) => {
    pendingScrollSourcePaneRef.current = sourcePane;

    if (scrollSyncFrameRef.current !== null) {
      return;
    }

    scrollSyncFrameRef.current = window.requestAnimationFrame(runSplitScrollSync);
  };

  const getTargetPane = (): PaneId => {
    if (mode === 'draft') {
      return 'draft';
    }

    if (mode === 'editor') {
      return 'editor';
    }

    return activePane;
  };

  const handleToggleFontStyleForPane = (
    targetPane: PaneId,
    fontStyleType: FontStyleType,
  ) => {
    const targetEditorView =
      targetPane === 'draft' ? draftEditorViewRef.current : editorEditorViewRef.current;

    if (!targetEditorView) {
      return;
    }

    const selections: TextSelectionRange[] = targetEditorView.state.selection.ranges
      .map((range) => ({
        from: range.from,
        to: range.to,
      }))
      .filter((range) => range.to > range.from);

    if (targetPane === 'draft') {
      if (selections.length > 0) {
        setDraftFontStyleRanges((currentRanges) =>
          toggleFontStyleRanges({
            ranges: currentRanges,
            type: fontStyleType,
            selections,
          }),
        );
      } else {
        setDraftActiveFontStyleTypes((currentTypes) =>
          toggleActiveFontStyleType(currentTypes, fontStyleType),
        );
      }
    } else if (selections.length > 0) {
      setEditorFontStyleRanges((currentRanges) =>
        toggleFontStyleRanges({
          ranges: currentRanges,
          type: fontStyleType,
          selections,
        }),
      );
    } else {
      setEditorActiveFontStyleTypes((currentTypes) =>
        toggleActiveFontStyleType(currentTypes, fontStyleType),
      );
    }

    targetEditorView.focus();
  };

  const handleToggleFontStyle = (fontStyleType: FontStyleType) => {
    handleToggleFontStyleForPane(getTargetPane(), fontStyleType);
  };

  const activeFontStyleTypes = getTargetPane() === 'draft'
    ? draftActiveFontStyleTypes
    : editorActiveFontStyleTypes;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#121314] text-[#D4D4D4]">
      <main className="min-h-0 flex-1">
        {mode === 'draft' && (
          <CodeMirrorPane
            value={draftText}
            onDocumentChange={({ value, changes }) => {
              setDraftText(value);
              setDraftFontStyleRanges((currentRanges) =>
                normalizeFontStyleRanges([
                  ...mapFontStyleRangesThroughChanges({
                    ranges: currentRanges,
                    changes,
                  }),
                  ...getInsertedFontStyleRanges({
                    changes,
                    activeTypes: draftActiveFontStyleTypesRef.current,
                  }),
                ]),
              );
            }}
            onFocusPane={() => setActivePane('draft')}
            onToggleFontStyle={(fontStyleType) =>
              handleToggleFontStyleForPane('draft', fontStyleType)
            }
            ariaLabel="Draft text"
            theme="draft"
            initialLineNumber={initialLineNumber}
            savedScrollOffset={draftScrollOffset}
            onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
              activeLineNumberRef.current = topVisibleLineNumber;
              setDraftScrollOffset(scrollOffset);
              syncSplitScroll('draft');
            }}
            draftHighlightRanges={draftHighlightRanges}
            fontStyleRanges={draftFontStyleRanges}
            draftLineDecorations={lineDecorations.draftLineDecorations}
            onEditorViewChange={(editorView) => {
              draftEditorViewRef.current = editorView;
            }}
          />
        )}

        {mode === 'editor' && (
          <CodeMirrorPane
            value={editorText}
            onDocumentChange={({ value, changes }) => {
              setEditorText(value);
              setEditorFontStyleRanges((currentRanges) =>
                normalizeFontStyleRanges([
                  ...mapFontStyleRangesThroughChanges({
                    ranges: currentRanges,
                    changes,
                  }),
                  ...getInsertedFontStyleRanges({
                    changes,
                    activeTypes: editorActiveFontStyleTypesRef.current,
                  }),
                ]),
              );
            }}
            onFocusPane={() => setActivePane('editor')}
            onToggleFontStyle={(fontStyleType) =>
              handleToggleFontStyleForPane('editor', fontStyleType)
            }
            ariaLabel="Editor text"
            theme="editor"
            initialLineNumber={initialLineNumber}
            savedScrollOffset={editorScrollOffset}
            onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
              activeLineNumberRef.current = topVisibleLineNumber;
              setEditorScrollOffset(scrollOffset);
              syncSplitScroll('editor');
            }}
            editorHighlightRanges={editorHighlightRanges}
            fontStyleRanges={editorFontStyleRanges}
            editorLineDecorations={lineDecorations.editorLineDecorations}
            lowestEditedLine={lowestEditedLine}
            onEditorViewChange={(editorView) => {
              editorEditorViewRef.current = editorView;
            }}
          />
        )}

        {mode === 'split' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <CodeMirrorPane
                value={draftText}
                onDocumentChange={({ value, changes }) => {
                  setDraftText(value);
                  setDraftFontStyleRanges((currentRanges) =>
                    normalizeFontStyleRanges([
                      ...mapFontStyleRangesThroughChanges({
                        ranges: currentRanges,
                        changes,
                      }),
                      ...getInsertedFontStyleRanges({
                        changes,
                        activeTypes: draftActiveFontStyleTypesRef.current,
                      }),
                    ]),
                  );
                }}
                onFocusPane={() => setActivePane('draft')}
                onToggleFontStyle={(fontStyleType) =>
                  handleToggleFontStyleForPane('draft', fontStyleType)
                }
                ariaLabel="Draft text"
                theme="draft"
                initialLineNumber={initialLineNumber}
                savedScrollOffset={draftScrollOffset}
                onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
                  activeLineNumberRef.current = topVisibleLineNumber;
                  setDraftScrollOffset(scrollOffset);
                  syncSplitScroll('draft');
                }}
                draftHighlightRanges={draftHighlightRanges}
                fontStyleRanges={draftFontStyleRanges}
                draftLineDecorations={lineDecorations.draftLineDecorations}
                onEditorViewChange={(editorView) => {
                  draftEditorViewRef.current = editorView;
                }}
              />
            </div>
            <div className="h-px bg-[#2A2B2C]" />
            <div className="min-h-0 flex-1">
              <CodeMirrorPane
                value={editorText}
                onDocumentChange={({ value, changes }) => {
                  setEditorText(value);
                  setEditorFontStyleRanges((currentRanges) =>
                    normalizeFontStyleRanges([
                      ...mapFontStyleRangesThroughChanges({
                        ranges: currentRanges,
                        changes,
                      }),
                      ...getInsertedFontStyleRanges({
                        changes,
                        activeTypes: editorActiveFontStyleTypesRef.current,
                      }),
                    ]),
                  );
                }}
                onFocusPane={() => setActivePane('editor')}
                onToggleFontStyle={(fontStyleType) =>
                  handleToggleFontStyleForPane('editor', fontStyleType)
                }
                ariaLabel="Editor text"
                theme="editor"
                initialLineNumber={initialLineNumber}
                savedScrollOffset={editorScrollOffset}
                onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
                  activeLineNumberRef.current = topVisibleLineNumber;
                  setEditorScrollOffset(scrollOffset);
                  syncSplitScroll('editor');
                }}
                editorHighlightRanges={editorHighlightRanges}
                fontStyleRanges={editorFontStyleRanges}
                editorLineDecorations={lineDecorations.editorLineDecorations}
                lowestEditedLine={lowestEditedLine}
                onEditorViewChange={(editorView) => {
                  editorEditorViewRef.current = editorView;
                }}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex h-8 shrink-0 items-center border-t border-[#2A2B2C] bg-[#191A1B] text-sm">
        <button
          type="button"
          onClick={handleModeToggle}
          className="flex h-full w-14 items-center justify-center border-r border-[#2A2B2C] text-center text-xs font-medium text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
        >
          {getModeLabel(mode)}
        </button>

        <a
          href="https://ko-fi.com/acejack"
          target="_blank"
          rel="noreferrer"
          onClick={handleCoffeeClick}
          aria-label="Support on Ko-fi"
          title="Support on Ko-fi"
          className="flex h-full w-8 items-center justify-center border-r border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
        >
          {coffeeStatus === 'clicked' ? <CheckIcon /> : <CoffeeIcon />}
        </a>

        <FooterStats
          mode={mode}
          statsMode={statsMode}
          draftText={draftText}
          editorStats={editorStats}
          onToggle={handleStatsModeToggle}
        />

        <FontStyleControls
          activeFontStyleTypes={activeFontStyleTypes}
          onToggleFontStyle={handleToggleFontStyle}
        />

        <button
          type="button"
          onClick={handleCopyText}
          aria-label={getCopyAriaLabel(copyStatus)}
          title={getCopyAriaLabel(copyStatus)}
          className="absolute right-0 flex h-full w-8 items-center justify-center border-l border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
        >
          {copyStatus === 'copied' ? <CheckIcon /> : <CopyIcon />}
        </button>
      </footer>
    </div>
  );
};

export default App;

// === Components ===

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

const CodeMirrorPane = ({
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
  const initialLineNumberRef = useRef(initialLineNumber);
  const initialScrollOffsetRef = useRef(savedScrollOffset);
  const decorationsRef = useRef<CodeMirrorDecorations>(
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
          onDocumentChange: ({ value: nextValue, changes }) =>
            onDocumentChangeRef.current({ value: nextValue, changes }),
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

    const currentValue = editorView.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    editorView.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [value]);

  return <div ref={containerRef} className="h-full w-full" />;
};

type FooterStatsProps = {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorStats: EditorStats;
  onToggle: () => void;
};

const FooterStats = ({
  mode,
  statsMode,
  draftText,
  editorStats,
  onToggle,
}: FooterStatsProps) => {
  const buttonClassName =
    'absolute left-1/2 inline-flex -translate-x-1/2 items-center text-center leading-none text-[#8C8C8C] focus:outline-none';

  if (mode === 'draft') {
    const draftBaseLabel =
      statsMode === 'words' ? `${getWordCount(draftText)}w` : `${draftText.length}c`;

    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle footer stats between words and characters"
        className={buttonClassName}
      >
        {draftBaseLabel}
      </button>
    );
  }

  const baseLabel =
    statsMode === 'words' ? `${editorStats.wordCount}w` : `${editorStats.characterCount}c`;
  const addedLabel =
    statsMode === 'words'
      ? `+${editorStats.addedWordCount}`
      : `+${editorStats.addedCharacterCount}`;
  const deletedLabel =
    statsMode === 'words'
      ? `-${editorStats.deletedWordCount}`
      : `-${editorStats.deletedCharacterCount}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle footer stats between words and characters"
      className={buttonClassName}
    >
      <span>{baseLabel}</span>
      <span className="ml-1 text-xs leading-none text-[#2A4C2C]">{addedLabel}</span>
      <span className="ml-1 text-xs leading-none text-[#693330]">{deletedLabel}</span>
    </button>
  );
};

type FontStyleControlsProps = {
  activeFontStyleTypes: FontStyleType[];
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
};

const FontStyleControls = ({
  activeFontStyleTypes,
  onToggleFontStyle,
}: FontStyleControlsProps) => {
  return (
    <div className="absolute right-8 flex h-full items-center gap-2 pr-2">
      <FontStyleControlButton
        label="B"
        ariaLabel="Toggle bold"
        isActive={activeFontStyleTypes.includes('bold')}
        onClick={() => onToggleFontStyle('bold')}
      />
      <FontStyleControlButton
        label="I"
        ariaLabel="Toggle italic"
        labelClassName="italic"
        labelStyle={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        isActive={activeFontStyleTypes.includes('italic')}
        onClick={() => onToggleFontStyle('italic')}
      />
      <FontStyleControlButton
        label="U"
        ariaLabel="Toggle underline"
        labelClassName="border-b border-current"
        isActive={activeFontStyleTypes.includes('underline')}
        onClick={() => onToggleFontStyle('underline')}
      />
    </div>
  );
};

type FontStyleControlButtonProps = {
  label: string;
  ariaLabel: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  isActive: boolean;
  onClick: () => void;
};

const FontStyleControlButton = ({
  label,
  ariaLabel,
  labelClassName,
  labelStyle,
  isActive,
  onClick,
}: FontStyleControlButtonProps) => {
  const stateClassName = isActive
    ? 'rounded-sm bg-[#242526] text-[#D4D4D4]'
    : 'rounded-sm text-[#8C8C8C]';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-1 text-xs font-normal ${stateClassName} hover:bg-[#242526] hover:text-[#D4D4D4] focus:outline-none focus-visible:bg-[#242526] focus-visible:text-[#D4D4D4]`}
    >
      <span
        className={`inline-flex h-4 min-w-3 items-center justify-center leading-none ${labelClassName ?? ''}`}
        style={labelStyle}
      >
        {label}
      </span>
    </button>
  );
};

const CopyIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
};

const CoffeeIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h13v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
      <path d="M16 10h2a2 2 0 1 1 0 4h-2" />
    </svg>
  );
};

const CheckIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
};

// === Helpers ===

type CodeMirrorExtensionOptions = {
  ariaLabel: string;
  theme: CodeMirrorTheme;
  onDocumentChange: ({
    value,
    changes,
  }: {
    value: string;
    changes: TextChange[];
  }) => void;
  onFocusPane: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onScroll: (scrollOffset: ScrollOffset, topVisibleLineNumber: number) => void;
};

type CodeMirrorDecorations = {
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
  fontStyleRanges: FontStyleRange[];
  lowestEditedLine: LowestEditedLine | null;
};

const setEditorDecorationsEffect = StateEffect.define<DecorationSet>();

const editorDecorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let nextDecorations = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(setEditorDecorationsEffect)) {
        nextDecorations = effect.value;
      }
    }

    return nextDecorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

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
    line.setAttribute('aria-hidden', 'true');

    return line;
  }

  ignoreEvent() {
    return true;
  }
}

const getCodeMirrorDecorationsInput = ({
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

const getCodeMirrorDecorations = (
  editorView: EditorView,
  decorations: CodeMirrorDecorations,
): DecorationSet => {
  const ranges: Range<Decoration>[] = [
    ...getFontStyleDecorations(decorations.fontStyleRanges),
    ...getEditorHighlightDecorations(decorations.editorHighlightRanges),
    ...getDraftHighlightDecorations(decorations.draftHighlightRanges),
    ...getEditorLineDecorations(editorView, decorations.editorLineDecorations),
    ...getDraftLineDecorations(editorView, decorations.draftLineDecorations),
    ...getLowestEditedLineDecorations(editorView, decorations.lowestEditedLine),
  ];

  return Decoration.set(ranges, true);
};

const getEditorHighlightDecorations = (
  highlightRanges: EditorHighlightRange[],
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of highlightRanges) {
    if (range.type === 'added') {
      if (range.to <= range.from) {
        continue;
      }

      decorations.push(
        Decoration.mark({ class: 'byline-added-text' }).range(range.from, range.to),
      );
      continue;
    }

    decorations.push(
      Decoration.widget({
        widget: new DeletedMarkerWidget(),
        side: -1,
      }).range(range.from),
    );
  }

  return decorations;
};

const getDraftHighlightDecorations = (
  draftHighlightRanges: DraftHighlightRange[],
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of draftHighlightRanges) {
    if (range.to <= range.from) {
      continue;
    }

    decorations.push(
      Decoration.mark({ class: 'byline-deleted-text' }).range(range.from, range.to),
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
): Range<Decoration>[] => {
  const decorations: Range<Decoration>[] = [];

  for (const range of fontStyleRanges) {
    if (range.to <= range.from) {
      continue;
    }

    const className = getFontStyleClassName(range.type);
    if (!className) {
      continue;
    }

    decorations.push(Decoration.mark({ class: className }).range(range.from, range.to));
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

const getCodeMirrorExtensions = ({
  ariaLabel,
  theme,
  onDocumentChange,
  onFocusPane,
  onToggleFontStyle,
  onScroll,
}: CodeMirrorExtensionOptions): Extension[] => {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    keymap.of([
      ...getFontStyleKeyBindings(onToggleFontStyle),
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': ariaLabel,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }

      const changes: TextChange[] = [];
      update.changes.iterChanges((fromA, toA, fromB, toB) => {
        changes.push({ fromA, toA, fromB, toB });
      });
      onDocumentChange({ value: update.state.doc.toString(), changes });
    }),
    EditorView.domEventHandlers({
      scroll: (_event, view) => {
        onScroll({
          left: view.scrollDOM.scrollLeft,
          top: view.scrollDOM.scrollTop,
        }, getTopVisibleLineNumber(view));
      },
      focus: () => {
        onFocusPane();
      },
    }),
    editorDecorationsField,
    getCodeMirrorTheme(theme),
  ];
};

const getFontStyleKeyBindings = (
  onToggleFontStyle: (fontStyleType: FontStyleType) => void,
): KeyBinding[] => {
  return [
    {
      key: 'Mod-b',
      run: () => {
        onToggleFontStyle('bold');
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: () => {
        onToggleFontStyle('italic');
        return true;
      },
    },
    {
      key: 'Mod-u',
      run: () => {
        onToggleFontStyle('underline');
        return true;
      },
    },
  ];
};

const getCodeMirrorTheme = (theme: CodeMirrorTheme): Extension => {
  const backgroundColor = theme === 'draft' ? '#191A1B' : '#121314';
  const textColor = theme === 'draft' ? '#BFBFBF' : '#D4D4D4';

  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor,
      color: textColor,
      fontSize: '16px',
    },
    '.cm-editor': {
      height: '100%',
      backgroundColor,
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: '1.5',
    },
    '.cm-content': {
      padding: '8px 12px',
      caretColor: '#D4D4D4',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      backgroundColor,
      color: '#858889',
      border: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      boxSizing: 'border-box',
      width: '6ch',
      minWidth: '6ch',
      paddingLeft: '0',
      paddingRight: '2ch',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: '#242526',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#BBBEBF',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#264F78 !important',
    },
    '.byline-added-text': {
      backgroundColor: '#2A4C2C',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      boxShadow: '0 -0.25em 0 #2A4C2C, 0 0.25em 0 #2A4C2C',
    },
    '.byline-deleted-text': {
      backgroundColor: '#693330',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      boxShadow: '0 -0.25em 0 #693330, 0 0.25em 0 #693330',
    },
    '.byline-added-line': {
      backgroundColor: '#2A4C2C',
    },
    '.cm-line.byline-added-line': {
      backgroundColor: '#2A4C2C',
    },
    '.byline-deleted-marker': {
      position: 'relative',
      display: 'inline-block',
      width: '0',
      height: '1em',
      verticalAlign: '-0.12em',
    },
    '.byline-deleted-marker-strip': {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '0.35ch',
      height: '1.5em',
      backgroundColor: '#693330',
    },
    '.byline-missing-line': {
      display: 'block',
      width: '100%',
      boxSizing: 'border-box',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(140, 140, 140, 0.7) 0, rgba(140, 140, 140, 0.7) 2px, transparent 2px, transparent 6px)',
    },
    '.cm-line.byline-deleted-draft-line': {
      backgroundColor: '#693330',
    },
    '.cm-line.byline-lowest-edited-line': {
      borderBottom: '1px dashed #8C8C8C',
    },
    '.byline-font-bold': {
      fontWeight: '700',
    },
    '.byline-font-italic': {
      fontStyle: 'italic',
    },
    '.byline-font-underline': {
      textDecoration: 'underline',
    },
  });
};

const getNextMode = (mode: AppMode): AppMode => {
  if (mode === 'split') {
    return 'draft';
  }

  if (mode === 'draft') {
    return 'editor';
  }

  return 'split';
};

const getNextStatsMode = (statsMode: StatsMode): StatsMode => {
  if (statsMode === 'words') {
    return 'characters';
  }

  return 'words';
};

const getModeLabel = (mode: AppMode): string => {
  if (mode === 'draft') {
    return 'Draft';
  }

  if (mode === 'editor') {
    return 'Editor';
  }

  return 'Split';
};

const getCopyAriaLabel = (copyStatus: CopyStatus): string => {
  if (copyStatus === 'copied') {
    return 'Copied text';
  }

  if (copyStatus === 'failed') {
    return 'Copy failed';
  }

  return 'Copy text with highlights';
};

const getStoredText = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const setStoredText = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so editing still works.
  }
};

const getStoredFontStyleRanges = (key: string): FontStyleRange[] => {
  try {
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const ranges = parsedValue.filter(isFontStyleRange);
    return normalizeFontStyleRanges(ranges);
  } catch {
    return [];
  }
};

const setStoredFontStyleRanges = (
  key: string,
  ranges: FontStyleRange[],
): void => {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(normalizeFontStyleRanges(ranges)),
    );
  } catch {
    // Ignore storage failures so editing still works.
  }
};

const toggleActiveFontStyleType = (
  activeTypes: FontStyleType[],
  fontStyleType: FontStyleType,
): FontStyleType[] => {
  if (activeTypes.includes(fontStyleType)) {
    return activeTypes.filter((type) => type !== fontStyleType);
  }

  return [...activeTypes, fontStyleType];
};

const isFontStyleRange = (value: unknown): value is FontStyleRange => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const range = value as {
    type?: unknown;
    from?: unknown;
    to?: unknown;
  };

  const isKnownType =
    range.type === 'bold' || range.type === 'italic' || range.type === 'underline';

  return (
    isKnownType &&
    typeof range.from === 'number' &&
    typeof range.to === 'number' &&
    Number.isFinite(range.from) &&
    Number.isFinite(range.to) &&
    range.to > range.from
  );
};

const getTopVisibleLineNumber = (editorView: EditorView): number => {
  const topBlock = editorView.lineBlockAtHeight(editorView.scrollDOM.scrollTop);
  return editorView.state.doc.lineAt(topBlock.from).number;
};

const clampLineNumber = (lineNumber: number, editorView: EditorView): number => {
  return Math.min(Math.max(1, lineNumber), editorView.state.doc.lines);
};

const scrollToLineNumber = (editorView: EditorView, lineNumber: number): void => {
  const clampedLineNumber = clampLineNumber(lineNumber, editorView);
  const line = editorView.state.doc.line(clampedLineNumber);
  const block = editorView.lineBlockAt(line.from);
  editorView.scrollDOM.scrollTop = block.top;
};

// === Types ===

type AppMode = 'draft' | 'editor' | 'split';

type CodeMirrorTheme = 'draft' | 'editor';

type ScrollOffset = {
  left: number;
  top: number;
};

type PaneId = 'draft' | 'editor';

type CopyStatus = 'idle' | 'copied' | 'failed';

type CoffeeStatus = 'idle' | 'clicked';

// === Constants ===

const storageKeys = {
  draftText: 'byline:draftText',
  editorText: 'byline:editorText',
  draftFontStyleRanges: 'byline:draftFontStyleRanges',
  editorFontStyleRanges: 'byline:editorFontStyleRanges',
} as const;
