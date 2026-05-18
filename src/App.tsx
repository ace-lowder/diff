import { useEffect, useMemo, useRef, useState } from 'react';

import { EditorView } from '@codemirror/view';

import {
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
  type StatsMode,
} from './editorDiff';
import { Footer } from './components/Footer';
import { CodeMirrorPane } from './components/CodeMirrorPane';
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
  type TextSelectionRange,
} from './fontStyles';
import {
  getStoredFontStyleRanges,
  getStoredText,
  setStoredFontStyleRanges,
  setStoredText,
  storageKeys,
} from './storage';
import {
  clampLineNumber,
  getTopVisibleLineNumber,
  scrollToLineNumber,
} from './editor/codeMirrorScroll';
import type {
  AppMode,
  CoffeeStatus,
  CopyStatus,
  PaneId,
  ScrollOffset,
} from './appTypes';

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

  const activeFontStyleTypes =
    getTargetPane() === 'draft'
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

      <Footer
        mode={mode}
        statsMode={statsMode}
        draftText={draftText}
        editorStats={editorStats}
        copyStatus={copyStatus}
        coffeeStatus={coffeeStatus}
        activeFontStyleTypes={activeFontStyleTypes}
        onModeToggle={handleModeToggle}
        onStatsModeToggle={handleStatsModeToggle}
        onToggleFontStyle={handleToggleFontStyle}
        onCopyText={handleCopyText}
        onCoffeeClick={handleCoffeeClick}
      />
    </div>
  );
};

export default App;

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

const toggleActiveFontStyleType = (
  activeTypes: FontStyleType[],
  fontStyleType: FontStyleType,
): FontStyleType[] => {
  if (activeTypes.includes(fontStyleType)) {
    return activeTypes.filter((type) => type !== fontStyleType);
  }

  return [...activeTypes, fontStyleType];
};
