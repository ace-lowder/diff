import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import { EditorView } from '@codemirror/view';

import { type StatsMode } from './editorDiff';
import type {
  ConsoleCommandLineContext,
  RunConsoleCommand,
} from './editor/codeMirrorConsoleCommands';
import { Menu } from './components/Menu';
import {
  getMenuEdgeTriggerClassName,
} from './components/menuVisibility';
import { CodeMirrorPane } from './components/CodeMirrorPane';
import { shouldRevealAutoHiddenControls } from './pointerEvents';
import {
  getClipboardFontStyleRangesForLine,
  getClipboardHighlightRangesForLine,
  getClipboardHtml,
  getDraftClipboardHighlightRanges,
  type ClipboardFontStyleRange,
  type ClipboardHighlightRange,
} from './clipboardExport';
import {
  areFontStyleRangesEqual,
  areTextSelectionRangesEqual,
  getActiveFontStyleTypesForSelections,
  toggleFontStyleRanges,
  type FontStyleRange,
  type FontStyleType,
  type StyledDocumentChange,
  type TextSelectionRange,
} from './fontStyles';
import {
  getFontSizeCssVariables,
  getNextFontSizeMode,
} from './fontSize';
import {
  getStoredMenuPlacement,
  getStoredMenuVisibilityMode,
  getStoredFontSizeMode,
  getInitialAppMode,
  getStoredLineGapMode,
  getStoredLineNumberPosition,
  getStoredLineNumberVisibilityMode,
  getStoredDocumentText,
  getStoredFontStyleRanges,
  getStoredWordWrappingEnabled,
  setStoredLineNumberPosition,
  setStoredLineNumberVisibilityMode,
  setStoredFontSizeMode,
  setStoredAppMode,
  setStoredLineGapMode,
  setStoredMenuPlacement,
  setStoredMenuVisibilityMode,
  setStoredFontStyleRanges,
  setStoredWordWrappingEnabled,
  setStoredText,
  storageKeys,
} from './storage';
import {
  clampLineNumber,
  getTopVisibleLineNumber,
  scrollToLineNumber,
} from './editor/codeMirrorScroll';
import { setDiffPaintTypingEffect } from './editor/codeMirrorDiffPaint';
import { LINE_NUMBER_AUTO_HIDE_DELAY_MS } from './editor/codeMirrorLineNumberSettings';
import { getVisibleLineNumberGutterWidthPx } from './editor/codeMirrorLineCopy';
import { useEditorDiffState } from './editor/useEditorDiffState';
import {
  getEditorWidthHandleStyle,
  type EditorWidthHandlePlacement,
} from './editor/editorWidthHandle';
import type {
  AppMode,
  CopyLineHandler,
  CoffeeStatus,
  LineNumberPosition,
  LineNumberVisibilityMode,
  FontSizeMode,
  LineGapMode,
  MenuVisibilityMode,
  MenuPlacement,
  TextLineContext,
  CopyStatus,
  PaneId,
  ScrollOffset,
} from './appTypes';

const MENU_AUTO_HIDE_DELAY_MS = 2000;
const STORED_TEXT_WRITE_DELAY_MS = 500;

const App = () => {
  const initialDocumentText = useMemo(() => getStoredDocumentText(), []);
  const initialMenuVisibilityMode = useMemo(
    () => getStoredMenuVisibilityMode(),
    [],
  );
  const initialLineNumberVisibilityMode = useMemo(
    () => getStoredLineNumberVisibilityMode(),
    [],
  );
  const initialFontSizeMode = useMemo(() => getStoredFontSizeMode(), []);

  const [mode, setMode] = useState<AppMode>(() =>
    getInitialAppMode(initialDocumentText),
  );
  const [statsMode, setStatsMode] = useState<StatsMode>('words');
  const [draftText, setDraftText] = useState(() => initialDocumentText.draftText);
  const [editorText, setEditorText] = useState(() => initialDocumentText.editorText);
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
  const [draftSelections, setDraftSelections] = useState<TextSelectionRange[]>([]);
  const [editorSelections, setEditorSelections] = useState<TextSelectionRange[]>([]);
  const [activePane, setActivePane] = useState<PaneId>('editor');
  const [draftScrollOffset, setDraftScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });
  const [editorScrollOffset, setEditorScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });
  const [editorWidthPercent, setEditorWidthPercent] = useState(
    DEFAULT_EDITOR_WIDTH_PERCENT,
  );
  const [splitDraftPercent, setSplitDraftPercent] = useState(
    DEFAULT_SPLIT_DRAFT_PERCENT,
  );
  const [initialLineNumber, setInitialLineNumber] = useState(1);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [coffeeStatus, setCoffeeStatus] = useState<CoffeeStatus>('idle');
  const [menuVisibilityMode, setMenuVisibilityMode] =
    useState<MenuVisibilityMode>(initialMenuVisibilityMode);
  const [isMenuVisible, setIsMenuVisible] = useState(
    initialMenuVisibilityMode === 'visible',
  );
  const [menuPlacement, setMenuPlacementState] = useState<MenuPlacement>(() =>
    getStoredMenuPlacement(),
  );
  const [lineNumberPosition, setLineNumberPosition] =
    useState<LineNumberPosition>(() => getStoredLineNumberPosition());
  const [lineNumberVisibilityMode, setLineNumberVisibilityMode] =
    useState<LineNumberVisibilityMode>(initialLineNumberVisibilityMode);
  const [fontSizeMode, setFontSizeMode] =
    useState<FontSizeMode>(initialFontSizeMode);
  const [lineGapMode, setLineGapMode] =
    useState<LineGapMode>(() => getStoredLineGapMode());
  const [isWordWrappingEnabled, setIsWordWrappingEnabled] = useState(() =>
    getStoredWordWrappingEnabled(),
  );
  const [areLineNumbersVisible, setAreLineNumbersVisible] = useState(
    initialLineNumberVisibilityMode === 'visible',
  );
  const [editorScrollbarWidthPx, setEditorScrollbarWidthPx] = useState(0);
  const [editorLineNumberGutterWidthPx, setEditorLineNumberGutterWidthPx] =
    useState(0);
  const draftEditorViewRef = useRef<EditorView | null>(null);
  const editorEditorViewRef = useRef<EditorView | null>(null);
  const suppressedScrollPaneRef = useRef<PaneId | null>(null);
  const activeLineNumberRef = useRef(1);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const pendingScrollSourcePaneRef = useRef<PaneId | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const splitResizePointerIdRef = useRef<number | null>(null);
  const editorWidthContainerRef = useRef<HTMLDivElement | null>(null);
  const editorWidthDragStateRef = useRef<EditorWidthDragState | null>(null);
  const editorMeasureFrameRef = useRef<number | null>(null);
  const copyStatusTimeoutRef = useRef<number | null>(null);
  const coffeeStatusTimeoutRef = useRef<number | null>(null);
  const menuHideTimeoutRef = useRef<number | null>(null);
  const lineNumberHideTimeoutRef = useRef<number | null>(null);
  const draftTextRef = useRef(draftText);
  const editorTextRef = useRef(editorText);
  const draftFontStyleRangesRef = useRef(draftFontStyleRanges);
  const editorFontStyleRangesRef = useRef(editorFontStyleRanges);
  const isDiffPaintPausedForTypingRef = useRef(false);
  const storedTextTimeoutRef = useRef<number | null>(null);
  const pendingStoredTextRef = useRef<
    Partial<Record<'draftText' | 'editorText', string>>
  >({});

  const shouldShowDraftDiff = editorText.length > 0;
  const fontSizeStyle = useMemo(
    () => getFontSizeCssVariables(fontSizeMode),
    [fontSizeMode],
  );

  const getCurrentDocumentTextSnapshot = useCallback(() => {
    return {
      draftText:
        draftEditorViewRef.current?.state.doc.toString() ?? draftTextRef.current,
      editorText:
        editorEditorViewRef.current?.state.doc.toString() ?? editorTextRef.current,
    };
  }, []);

  const syncCommittedDocumentText = useCallback(({
    draftText: nextDraftText,
    editorText: nextEditorText,
  }: {
    draftText: string;
    editorText: string;
  }) => {
    draftTextRef.current = nextDraftText;
    editorTextRef.current = nextEditorText;

    setDraftText((currentText) =>
      currentText === nextDraftText ? currentText : nextDraftText,
    );
    setEditorText((currentText) =>
      currentText === nextEditorText ? currentText : nextEditorText,
    );
  }, []);

  const handleEditorDiffStateCommit = useCallback(() => {
    isDiffPaintPausedForTypingRef.current = false;
  }, []);

  const { editorDiffState, flushEditorDiffState } = useEditorDiffState({
    draftText,
    editorText,
    getCurrentText: getCurrentDocumentTextSnapshot,
    syncCommittedText: syncCommittedDocumentText,
    onStateCommit: handleEditorDiffStateCommit,
  });
  const {
    editorHighlightRanges,
    draftHighlightRanges,
    lineDecorations,
    lowestEditedLine,
    editorStats,
  } = editorDiffState;

  const pauseDiffPaintForTyping = useCallback(() => {
    if (isDiffPaintPausedForTypingRef.current) {
      return;
    }

    isDiffPaintPausedForTypingRef.current = true;

    for (const editorView of [
      draftEditorViewRef.current,
      editorEditorViewRef.current,
    ]) {
      editorView?.dispatch({
        effects: setDiffPaintTypingEffect.of(true),
      });
    }
  }, []);

  const clearStoredTextTimeout = () => {
    if (storedTextTimeoutRef.current !== null) {
      window.clearTimeout(storedTextTimeoutRef.current);
      storedTextTimeoutRef.current = null;
    }
  };

  const flushStoredText = useCallback(() => {
    clearStoredTextTimeout();

    if (pendingStoredTextRef.current.draftText !== undefined) {
      setStoredText(storageKeys.draftText, pendingStoredTextRef.current.draftText);
    }

    if (pendingStoredTextRef.current.editorText !== undefined) {
      setStoredText(storageKeys.editorText, pendingStoredTextRef.current.editorText);
    }

    pendingStoredTextRef.current = {};
  }, []);

  const flushCurrentDocumentTextToStorage = useCallback(() => {
    const nextText = getCurrentDocumentTextSnapshot();
    setStoredText(storageKeys.draftText, nextText.draftText);
    setStoredText(storageKeys.editorText, nextText.editorText);
    pendingStoredTextRef.current = {};
  }, [getCurrentDocumentTextSnapshot]);

  const scheduleStoredTextWrite = useCallback(
    (key: 'draftText' | 'editorText', value: string) => {
      pendingStoredTextRef.current = {
        ...pendingStoredTextRef.current,
        [key]: value,
      };

      clearStoredTextTimeout();
      storedTextTimeoutRef.current = window.setTimeout(() => {
        flushStoredText();
      }, STORED_TEXT_WRITE_DELAY_MS);
    },
    [flushStoredText],
  );

  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  useEffect(() => {
    editorTextRef.current = editorText;
  }, [editorText]);

  useEffect(() => {
    draftFontStyleRangesRef.current = draftFontStyleRanges;
  }, [draftFontStyleRanges]);

  useEffect(() => {
    editorFontStyleRangesRef.current = editorFontStyleRanges;
  }, [editorFontStyleRanges]);

  useEffect(() => {
    scheduleStoredTextWrite('draftText', draftText);
  }, [draftText, scheduleStoredTextWrite]);

  useEffect(() => {
    scheduleStoredTextWrite('editorText', editorText);
  }, [editorText, scheduleStoredTextWrite]);

  useEffect(() => {
    window.addEventListener('pagehide', flushCurrentDocumentTextToStorage);

    return () => {
      window.removeEventListener('pagehide', flushCurrentDocumentTextToStorage);
      flushCurrentDocumentTextToStorage();
      flushStoredText();
    };
  }, [flushCurrentDocumentTextToStorage, flushStoredText]);

  useEffect(() => {
    setStoredFontStyleRanges(storageKeys.draftFontStyleRanges, draftFontStyleRanges);
  }, [draftFontStyleRanges]);

  useEffect(() => {
    setStoredFontStyleRanges(storageKeys.editorFontStyleRanges, editorFontStyleRanges);
  }, [editorFontStyleRanges]);

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
      if (menuHideTimeoutRef.current !== null) {
        window.clearTimeout(menuHideTimeoutRef.current);
      }
      if (lineNumberHideTimeoutRef.current !== null) {
        window.clearTimeout(lineNumberHideTimeoutRef.current);
      }
      if (storedTextTimeoutRef.current !== null) {
        window.clearTimeout(storedTextTimeoutRef.current);
      }
      if (editorMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(editorMeasureFrameRef.current);
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
    setPersistentAppMode(getNextMode(mode));
  };

  const setPersistentAppMode = (nextMode: AppMode) => {
    setStoredAppMode(nextMode);
    setMode(nextMode);
  };

  const handleStatsModeToggle = () => {
    setStatsMode((currentStatsMode) => getNextStatsMode(currentStatsMode));
  };

  const clearMenuHideTimeout = () => {
    if (menuHideTimeoutRef.current !== null) {
      window.clearTimeout(menuHideTimeoutRef.current);
      menuHideTimeoutRef.current = null;
    }
  };

  const showMenu = () => {
    clearMenuHideTimeout();
    setIsMenuVisible(true);
  };

  const handleMenuPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (!shouldRevealAutoHiddenControls(event.pointerType)) {
      return;
    }

    showMenu();
  };

  const scheduleMenuHide = () => {
    clearMenuHideTimeout();
    if (menuVisibilityMode !== 'autoHide') {
      return;
    }

    menuHideTimeoutRef.current = window.setTimeout(() => {
      setIsMenuVisible(false);
      menuHideTimeoutRef.current = null;
    }, MENU_AUTO_HIDE_DELAY_MS);
  };

  const enableMenuAutoHide = () => {
    setStoredMenuVisibilityMode('autoHide');
    setMenuVisibilityMode('autoHide');
    setIsMenuVisible(true);
    clearMenuHideTimeout();
    menuHideTimeoutRef.current = window.setTimeout(() => {
      setIsMenuVisible(false);
      menuHideTimeoutRef.current = null;
    }, MENU_AUTO_HIDE_DELAY_MS);
  };

  const showMenuAlways = () => {
    setStoredMenuVisibilityMode('visible');
    setMenuVisibilityMode('visible');
    setIsMenuVisible(true);
    clearMenuHideTimeout();
  };

  const setMenuPlacement = (placement: MenuPlacement) => {
    setMenuPlacementState(placement);
    setStoredMenuPlacement(placement);
  };

  const setPersistentLineNumberPosition = (
    position: LineNumberPosition,
  ) => {
    setStoredLineNumberPosition(position);
    setLineNumberPosition(position);
  };

  const setPersistentLineNumberVisibilityMode = (
    visibilityMode: LineNumberVisibilityMode,
  ) => {
    clearLineNumberHideTimeout();
    setStoredLineNumberVisibilityMode(visibilityMode);
    setLineNumberVisibilityMode(visibilityMode);
    setAreLineNumbersVisible(visibilityMode === 'visible');
  };

  const clearLineNumberHideTimeout = () => {
    if (lineNumberHideTimeoutRef.current !== null) {
      window.clearTimeout(lineNumberHideTimeoutRef.current);
      lineNumberHideTimeoutRef.current = null;
    }
  };

  const showLineNumbers = () => {
    clearLineNumberHideTimeout();
    setAreLineNumbersVisible(true);
  };

  const setPersistentFontSizeMode = (nextFontSizeMode: FontSizeMode) => {
    setStoredFontSizeMode(nextFontSizeMode);
    setFontSizeMode(nextFontSizeMode);
  };

  const setPersistentLineGapMode = (nextLineGapMode: LineGapMode) => {
    setStoredLineGapMode(nextLineGapMode);
    setLineGapMode(nextLineGapMode);
  };

  const setPersistentWordWrappingEnabled = (
    nextWordWrappingEnabled: boolean,
  ) => {
    setStoredWordWrappingEnabled(nextWordWrappingEnabled);
    setIsWordWrappingEnabled(nextWordWrappingEnabled);
  };

  const handleFontSizeToggle = () => {
    setPersistentFontSizeMode(getNextFontSizeMode(fontSizeMode));
  };

  const scheduleLineNumbersHide = () => {
    clearLineNumberHideTimeout();

    if (lineNumberVisibilityMode !== 'autoHide') {
      return;
    }

    lineNumberHideTimeoutRef.current = window.setTimeout(() => {
      setAreLineNumbersVisible(false);
      lineNumberHideTimeoutRef.current = null;
    }, LINE_NUMBER_AUTO_HIDE_DELAY_MS);
  };

  const handleCopyText = async () => {
    const snapshot = getCurrentDocumentTextSnapshot();
    const nextDiffState = flushEditorDiffState();
    const copyText = mode === 'draft' ? snapshot.draftText : snapshot.editorText;
    await copyDocumentText({
      copyText,
      clipboardHighlightRanges:
        mode === 'draft'
          ? getDraftClipboardHighlightRanges({
              text: snapshot.draftText,
              highlightRanges: nextDiffState.draftHighlightRanges
                .filter((range) => range.type === 'deleted')
                .map((range) => ({
                  type: 'deleted',
                  from: range.from,
                  to: range.to,
                })),
            })
          : nextDiffState.editorHighlightRanges,
      fontStyleRanges: mode === 'draft' ? draftFontStyleRanges : editorFontStyleRanges,
    });
  };

  const copyEditorLineText = async (line: ConsoleCommandLineContext) => {
    try {
      await writeEditorLineText(line);
      setTemporaryCopyStatus('copied');
    } catch {
      setTemporaryCopyStatus('failed');
    }
  };

  const writeEditorLineText = async (line: TextLineContext) => {
    const nextDiffState = flushEditorDiffState();
    const htmlText = getClipboardHtml({
      text: line.text,
      highlightRanges: getClipboardHighlightRangesForLine({
        lineFrom: line.from,
        lineTo: line.to,
        highlightRanges: nextDiffState.editorHighlightRanges,
      }),
      fontStyleRanges: getClipboardFontStyleRangesForLine({
        lineFrom: line.from,
        lineTo: line.to,
        fontStyleRanges: editorFontStyleRanges,
      }),
    });

    await writeClipboardText({
      plainText: line.text,
      htmlText,
    });
  };

  const handleCopyLine: CopyLineHandler = async ({ pane, line }) => {
    try {
      if (pane === 'editor') {
        await writeEditorLineText(line);
        return true;
      }

      await navigator.clipboard.writeText(line.text);
      return true;
    } catch {
      return false;
    }
  };

  const copyDocumentText = async ({
    copyText,
    clipboardHighlightRanges,
    fontStyleRanges,
  }: {
    copyText: string;
    clipboardHighlightRanges: ClipboardHighlightRange[];
    fontStyleRanges: ClipboardFontStyleRange[];
  }) => {
    try {
      const htmlText = getClipboardHtml({
        text: copyText,
        highlightRanges: clipboardHighlightRanges,
        fontStyleRanges,
      });
      await writeClipboardText({
        plainText: copyText,
        htmlText,
      });
      setTemporaryCopyStatus('copied');
    } catch {
      setTemporaryCopyStatus('failed');
    }
  };

  const setTemporaryCopyStatus = (status: CopyStatus) => {
    setCopyStatus(status);

    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
    }

    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle');
      copyStatusTimeoutRef.current = null;
    }, 1500);
  };

  const handleRunConsoleCommand: RunConsoleCommand = async (command, context) => {
    if (command.type === 'select') {
      return;
    }

    if (command.type === 'view') {
      if (command.mode === 'next') {
        handleModeToggle();
        return;
      }

      refreshActiveLineFromVisiblePane();
      setInitialLineNumber(activeLineNumberRef.current);
      setPersistentAppMode(command.mode);
      return;
    }

    if (command.type === 'copy') {
      if (command.target === 'document') {
        await handleCopyText();
        return;
      }

      if (context.pane === 'editor' && context.previousLine) {
        await copyEditorLineText(context.previousLine);
        return;
      }

      try {
        await navigator.clipboard.writeText(context.previousLineText);
        setTemporaryCopyStatus('copied');
      } catch {
        setTemporaryCopyStatus('failed');
      }
      return;
    }

    if (command.type === 'menu') {
      if (command.action === 'visibility') {
        if (command.visibilityMode === 'autoHide') {
          enableMenuAutoHide();
          return;
        }

        showMenuAlways();
        return;
      }

      setMenuPlacement(command.placement);
      return;
    }

    if (command.type === 'lineNumbers') {
      if (command.action === 'position') {
        setPersistentLineNumberPosition(command.position);
        return;
      }

      setPersistentLineNumberVisibilityMode(command.visibilityMode);
      return;
    }

    if (command.type === 'fontSize') {
      setPersistentFontSizeMode(command.fontSizeMode);
      return;
    }

    if (command.type === 'gap') {
      if (command.lineGapMode === 'toggle') {
        setPersistentLineGapMode(
          lineGapMode === 'normal' ? 'large' : 'normal',
        );
        return;
      }

      setPersistentLineGapMode(command.lineGapMode);
      return;
    }

    if (command.type === 'wrap') {
      setPersistentWordWrappingEnabled(!isWordWrappingEnabled);
      return;
    }

    if (command.statsMode === 'toggle') {
      handleStatsModeToggle();
      return;
    }

    setStatsMode(command.statsMode);
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

  const getEditorScrollbarWidth = (): number => {
    const widths = [draftEditorViewRef.current, editorEditorViewRef.current]
      .map((view) => {
        if (!view) {
          return 0;
        }

        return Math.max(
          0,
          view.scrollDOM.offsetWidth - view.scrollDOM.clientWidth,
        );
      });

    return Math.max(...widths);
  };

  const getEditorLineNumberGutterWidth = (): number => {
    const widths = [draftEditorViewRef.current, editorEditorViewRef.current]
      .map((view) => {
        return view ? getVisibleLineNumberGutterWidthPx(view) : 0;
      });

    return Math.max(...widths);
  };

  const requestEditorMeasure = useCallback(() => {
    if (editorMeasureFrameRef.current !== null) {
      return;
    }

    editorMeasureFrameRef.current = window.requestAnimationFrame(() => {
      editorMeasureFrameRef.current = null;
      draftEditorViewRef.current?.requestMeasure();
      editorEditorViewRef.current?.requestMeasure();

      const nextScrollbarWidth = getEditorScrollbarWidth();
      setEditorScrollbarWidthPx((currentWidth) => {
        return currentWidth === nextScrollbarWidth
          ? currentWidth
          : nextScrollbarWidth;
      });

      const nextLineNumberGutterWidth = getEditorLineNumberGutterWidth();
      setEditorLineNumberGutterWidthPx((currentWidth) => {
        return currentWidth === nextLineNumberGutterWidth
          ? currentWidth
          : nextLineNumberGutterWidth;
      });
    });
  }, []);

  const getSplitDraftPercentFromClientY = (clientY: number): number | null => {
    const splitContainer = splitContainerRef.current;

    if (!splitContainer) {
      return null;
    }

    const rect = splitContainer.getBoundingClientRect();

    if (rect.height === 0) {
      return null;
    }

    const rawPercent = ((clientY - rect.top) / rect.height) * 100;
    return Math.min(
      MAX_SPLIT_DRAFT_PERCENT,
      Math.max(MIN_SPLIT_DRAFT_PERCENT, rawPercent),
    );
  };

  const updateSplitDraftPercentFromClientY = (clientY: number) => {
    const nextPercent = getSplitDraftPercentFromClientY(clientY);

    if (nextPercent === null) {
      return;
    }

    setSplitDraftPercent(nextPercent);
    requestEditorMeasure();
  };

  const handleSplitResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    splitResizePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSplitDraftPercentFromClientY(event.clientY);
  };

  const handleSplitResizePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (splitResizePointerIdRef.current !== event.pointerId) {
      return;
    }

    updateSplitDraftPercentFromClientY(event.clientY);
  };

  const handleSplitResizePointerUp = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (splitResizePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    splitResizePointerIdRef.current = null;
  };

  const handleSplitResizeDoubleClick = () => {
    setSplitDraftPercent(DEFAULT_SPLIT_DRAFT_PERCENT);
    requestEditorMeasure();
  };

  const getEditorWidthPercentFromDragDelta = ({
    startEditorWidthPercent,
    containerWidth,
    deltaX,
    placement,
  }: {
    startEditorWidthPercent: number;
    containerWidth: number;
    deltaX: number;
    placement: Exclude<EditorWidthHandlePlacement, 'none'>;
  }): number => {
    const deltaPercent = ((deltaX * 2) / containerWidth) * 100;
    const nextPercent =
      placement === 'beforeRightGutter'
        ? startEditorWidthPercent + deltaPercent
        : startEditorWidthPercent - deltaPercent;

    return Math.min(
      MAX_EDITOR_WIDTH_PERCENT,
      Math.max(MIN_EDITOR_WIDTH_PERCENT, nextPercent),
    );
  };

  const handleEditorWidthPointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (editorWidthHandlePlacement === 'none') {
      return;
    }

    if (window.innerWidth < EDITOR_WIDTH_RESIZE_MIN_SCREEN_WIDTH) {
      return;
    }

    const editorWidthContainer = editorWidthContainerRef.current;
    const parentElement = editorWidthContainer?.parentElement;
    const containerWidth = parentElement?.getBoundingClientRect().width ?? 0;

    if (containerWidth <= 0) {
      return;
    }

    event.preventDefault();
    editorWidthDragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startEditorWidthPercent: editorWidthPercent,
      containerWidth,
      placement: editorWidthHandlePlacement,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleEditorWidthPointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const dragState = editorWidthDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const nextPercent = getEditorWidthPercentFromDragDelta({
      startEditorWidthPercent: dragState.startEditorWidthPercent,
      containerWidth: dragState.containerWidth,
      deltaX,
      placement: dragState.placement,
    });

    setEditorWidthPercent(nextPercent);
    requestEditorMeasure();
  };

  const handleEditorWidthPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = editorWidthDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    editorWidthDragStateRef.current = null;
  };

  const handleEditorWidthDoubleClick = () => {
    setEditorWidthPercent(DEFAULT_EDITOR_WIDTH_PERCENT);
    requestEditorMeasure();
  };

  const setDraftSelectionsIfChanged = useCallback(
    (nextSelections: TextSelectionRange[]) => {
      setDraftSelections((currentSelections) =>
        areTextSelectionRangesEqual(currentSelections, nextSelections)
          ? currentSelections
          : nextSelections,
      );
    },
    [],
  );

  const setEditorSelectionsIfChanged = useCallback(
    (nextSelections: TextSelectionRange[]) => {
      setEditorSelections((currentSelections) =>
        areTextSelectionRangesEqual(currentSelections, nextSelections)
          ? currentSelections
          : nextSelections,
      );
    },
    [],
  );

  const setDraftFontStyleRangesIfChanged = useCallback(
    (nextRanges: FontStyleRange[]) => {
      setDraftFontStyleRanges((currentRanges) => {
        if (areFontStyleRangesEqual(currentRanges, nextRanges)) {
          return currentRanges;
        }

        draftFontStyleRangesRef.current = nextRanges;
        return nextRanges;
      });
    },
    [],
  );

  const setEditorFontStyleRangesIfChanged = useCallback(
    (nextRanges: FontStyleRange[]) => {
      setEditorFontStyleRanges((currentRanges) => {
        if (areFontStyleRangesEqual(currentRanges, nextRanges)) {
          return currentRanges;
        }

        editorFontStyleRangesRef.current = nextRanges;
        return nextRanges;
      });
    },
    [],
  );

  const handleDraftDocumentChange = useCallback(
    ({ fontStyleRanges }: StyledDocumentChange) => {
      setDraftFontStyleRangesIfChanged(fontStyleRanges);
    },
    [setDraftFontStyleRangesIfChanged],
  );

  const handleEditorDocumentChange = useCallback(
    ({ fontStyleRanges }: StyledDocumentChange) => {
      setEditorFontStyleRangesIfChanged(fontStyleRanges);
    },
    [setEditorFontStyleRangesIfChanged],
  );

  const setDraftTextIfChanged = useCallback((nextText: string) => {
    setDraftText((currentText) => {
      if (currentText === nextText) {
        return currentText;
      }

      draftTextRef.current = nextText;
      return nextText;
    });
  }, []);

  const setEditorTextIfChanged = useCallback((nextText: string) => {
    setEditorText((currentText) => {
      if (currentText === nextText) {
        return currentText;
      }

      editorTextRef.current = nextText;
      return nextText;
    });
  }, []);

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
            text: targetEditorView.state.doc.toString(),
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
          text: targetEditorView.state.doc.toString(),
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
    handleToggleFontStyleForPane(targetPane, fontStyleType);
  };

  const targetPane = getTargetPane();
  const activeFontStyleTypes = useMemo(() => {
    if (targetPane === 'draft') {
      return getActiveFontStyleTypesForSelections({
        ranges: draftFontStyleRanges,
        selections: draftSelections,
        fallbackActiveTypes: draftActiveFontStyleTypes,
      });
    }

    return getActiveFontStyleTypesForSelections({
      ranges: editorFontStyleRanges,
      selections: editorSelections,
      fallbackActiveTypes: editorActiveFontStyleTypes,
    });
  }, [
    targetPane,
    draftFontStyleRanges,
    draftSelections,
    draftActiveFontStyleTypes,
    editorFontStyleRanges,
    editorSelections,
    editorActiveFontStyleTypes,
  ]);
  const editorWidthHandlePlacement = getEditorWidthHandlePlacement({
    lineNumberPosition,
    lineNumberVisibilityMode,
    areLineNumbersVisible,
  });

  useEffect(() => {
    requestEditorMeasure();
  }, [
    lineNumberPosition,
    lineNumberVisibilityMode,
    areLineNumbersVisible,
    mode,
    requestEditorMeasure,
  ]);

  useEffect(() => {
    requestEditorMeasure();
  }, [fontSizeMode, requestEditorMeasure]);

  return (
    <div
      style={fontSizeStyle}
      className="flex h-screen flex-col overflow-hidden bg-[#121314] text-[#D4D4D4]"
    >
      {menuVisibilityMode === 'autoHide' && (
        <div
          aria-hidden="true"
          onPointerEnter={handleMenuPointerEnter}
          className={getMenuEdgeTriggerClassName({ placement: menuPlacement })}
        />
      )}
      <main className="min-h-0 flex-1">
        <div className="relative flex h-full min-h-0 justify-center">
          <div
            ref={editorWidthContainerRef}
            className="relative h-full min-h-0"
            style={{ width: `${editorWidthPercent}%` }}
          >
            {mode === 'draft' && (
              <CodeMirrorPane
                value={draftText}
                onDocumentChange={handleDraftDocumentChange}
                onCommittedValueChange={setDraftTextIfChanged}
                onTypingActivity={pauseDiffPaintForTyping}
                onFocusPane={() => setActivePane('draft')}
                onToggleFontStyle={(fontStyleType) =>
                  handleToggleFontStyleForPane('draft', fontStyleType)
                }
                onRunConsoleCommand={handleRunConsoleCommand}
                onCopyLine={handleCopyLine}
                onSelectionChange={setDraftSelectionsIfChanged}
                activeFontStyleTypes={draftActiveFontStyleTypes}
                lineGapMode={lineGapMode}
                isWordWrappingEnabled={isWordWrappingEnabled}
                lineNumberPosition={lineNumberPosition}
                lineNumberVisibilityMode={lineNumberVisibilityMode}
                areLineNumbersVisible={areLineNumbersVisible}
                onShowLineNumbers={showLineNumbers}
                onScheduleLineNumbersHide={scheduleLineNumbersHide}
                fontSizeMode={fontSizeMode}
                onContentLayoutChange={requestEditorMeasure}
                ariaLabel="Draft text"
                theme="draft"
                initialLineNumber={initialLineNumber}
                savedScrollOffset={draftScrollOffset}
                onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
                  activeLineNumberRef.current = topVisibleLineNumber;
                  setDraftScrollOffset(scrollOffset);
                  syncSplitScroll('draft');
                }}
                draftHighlightRanges={shouldShowDraftDiff ? draftHighlightRanges : []}
                fontStyleRanges={draftFontStyleRanges}
                draftLineDecorations={
                  shouldShowDraftDiff ? lineDecorations.draftLineDecorations : []
                }
                onEditorViewChange={(editorView) => {
                  draftEditorViewRef.current = editorView;
                  requestEditorMeasure();
                }}
              />
            )}

            {mode === 'editor' && (
              <CodeMirrorPane
                value={editorText}
                onDocumentChange={handleEditorDocumentChange}
                onCommittedValueChange={setEditorTextIfChanged}
                onTypingActivity={pauseDiffPaintForTyping}
                onFocusPane={() => setActivePane('editor')}
                onToggleFontStyle={(fontStyleType) =>
                  handleToggleFontStyleForPane('editor', fontStyleType)
                }
                onRunConsoleCommand={handleRunConsoleCommand}
                onCopyLine={handleCopyLine}
                onSelectionChange={setEditorSelectionsIfChanged}
                activeFontStyleTypes={editorActiveFontStyleTypes}
                lineGapMode={lineGapMode}
                isWordWrappingEnabled={isWordWrappingEnabled}
                lineNumberPosition={lineNumberPosition}
                lineNumberVisibilityMode={lineNumberVisibilityMode}
                areLineNumbersVisible={areLineNumbersVisible}
                onShowLineNumbers={showLineNumbers}
                onScheduleLineNumbersHide={scheduleLineNumbersHide}
                fontSizeMode={fontSizeMode}
                onContentLayoutChange={requestEditorMeasure}
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
                  requestEditorMeasure();
                }}
              />
            )}

            {mode === 'split' && (
              <div ref={splitContainerRef} className="flex h-full min-h-0 flex-col">
                <div
                  className="min-h-0 shrink-0"
                  style={{ flexBasis: `${splitDraftPercent}%` }}
                >
                  <CodeMirrorPane
                    value={draftText}
                    onDocumentChange={handleDraftDocumentChange}
                    onCommittedValueChange={setDraftTextIfChanged}
                    onTypingActivity={pauseDiffPaintForTyping}
                    onFocusPane={() => setActivePane('draft')}
                    onToggleFontStyle={(fontStyleType) =>
                      handleToggleFontStyleForPane('draft', fontStyleType)
                    }
                    onRunConsoleCommand={handleRunConsoleCommand}
                    onCopyLine={handleCopyLine}
                    onSelectionChange={setDraftSelectionsIfChanged}
                    activeFontStyleTypes={draftActiveFontStyleTypes}
                    lineGapMode={lineGapMode}
                    isWordWrappingEnabled={isWordWrappingEnabled}
                    lineNumberPosition={lineNumberPosition}
                    lineNumberVisibilityMode={lineNumberVisibilityMode}
                    areLineNumbersVisible={areLineNumbersVisible}
                    onShowLineNumbers={showLineNumbers}
                    onScheduleLineNumbersHide={scheduleLineNumbersHide}
                    fontSizeMode={fontSizeMode}
                    onContentLayoutChange={requestEditorMeasure}
                    ariaLabel="Draft text"
                    theme="draft"
                    initialLineNumber={initialLineNumber}
                    savedScrollOffset={draftScrollOffset}
                    onScrollOffsetChange={(scrollOffset, topVisibleLineNumber) => {
                      activeLineNumberRef.current = topVisibleLineNumber;
                      setDraftScrollOffset(scrollOffset);
                      syncSplitScroll('draft');
                    }}
                    draftHighlightRanges={
                      shouldShowDraftDiff ? draftHighlightRanges : []
                    }
                    fontStyleRanges={draftFontStyleRanges}
                    draftLineDecorations={
                      shouldShowDraftDiff ? lineDecorations.draftLineDecorations : []
                    }
                    onEditorViewChange={(editorView) => {
                      draftEditorViewRef.current = editorView;
                      requestEditorMeasure();
                    }}
                  />
                </div>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuemin={MIN_SPLIT_DRAFT_PERCENT}
                  aria-valuemax={MAX_SPLIT_DRAFT_PERCENT}
                  aria-valuenow={Math.round(splitDraftPercent)}
                  onPointerDown={handleSplitResizePointerDown}
                  onPointerMove={handleSplitResizePointerMove}
                  onPointerUp={handleSplitResizePointerUp}
                  onPointerCancel={handleSplitResizePointerUp}
                  onDoubleClick={handleSplitResizeDoubleClick}
                  className="group relative h-2 shrink-0 cursor-row-resize touch-none select-none"
                >
                  <div className="absolute left-0 top-0 h-px w-full bg-[#2A2B2C] group-hover:bg-[#3A3B3C]" />
                </div>
                <div className="min-h-0 flex-1">
                  <CodeMirrorPane
                    value={editorText}
                    onDocumentChange={handleEditorDocumentChange}
                    onCommittedValueChange={setEditorTextIfChanged}
                    onTypingActivity={pauseDiffPaintForTyping}
                    onFocusPane={() => setActivePane('editor')}
                    onToggleFontStyle={(fontStyleType) =>
                      handleToggleFontStyleForPane('editor', fontStyleType)
                    }
                    onRunConsoleCommand={handleRunConsoleCommand}
                    onCopyLine={handleCopyLine}
                    onSelectionChange={setEditorSelectionsIfChanged}
                    activeFontStyleTypes={editorActiveFontStyleTypes}
                    lineGapMode={lineGapMode}
                    isWordWrappingEnabled={isWordWrappingEnabled}
                    lineNumberPosition={lineNumberPosition}
                    lineNumberVisibilityMode={lineNumberVisibilityMode}
                    areLineNumbersVisible={areLineNumbersVisible}
                    onShowLineNumbers={showLineNumbers}
                    onScheduleLineNumbersHide={scheduleLineNumbersHide}
                    fontSizeMode={fontSizeMode}
                    onContentLayoutChange={requestEditorMeasure}
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
                      requestEditorMeasure();
                    }}
                  />
                </div>
              </div>
            )}

            {editorWidthHandlePlacement !== 'none' && (
              <div
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={MIN_EDITOR_WIDTH_PERCENT}
              aria-valuemax={MAX_EDITOR_WIDTH_PERCENT}
              aria-valuenow={Math.round(editorWidthPercent)}
              onPointerDown={handleEditorWidthPointerDown}
              onPointerMove={handleEditorWidthPointerMove}
              onPointerUp={handleEditorWidthPointerUp}
              onPointerCancel={handleEditorWidthPointerUp}
              onDoubleClick={handleEditorWidthDoubleClick}
              className={`group absolute bottom-0 top-0 z-[60] hidden cursor-col-resize touch-none select-none sm:block ${getEditorWidthHandleWidthClassName()} ${getEditorWidthHandleTransformClassName(editorWidthHandlePlacement)}`}
              style={getEditorWidthHandleStyle({
                placement: editorWidthHandlePlacement,
                lineNumberGutterWidthPx: editorLineNumberGutterWidthPx,
                scrollbarWidthPx: editorScrollbarWidthPx,
              })}
            >
              <div
                className={`absolute h-full w-px ${getEditorWidthHandleLineColorClassName()} ${getEditorWidthHandleLineClassName()}`}
              />
              </div>
            )}
          </div>
        </div>
      </main>

      <Menu
        mode={mode}
        statsMode={statsMode}
        draftText={draftText}
        editorText={editorText}
        editorStats={editorStats}
        copyStatus={copyStatus}
        coffeeStatus={coffeeStatus}
        fontSizeMode={fontSizeMode}
        activeFontStyleTypes={activeFontStyleTypes}
        onModeToggle={handleModeToggle}
        onFontSizeToggle={handleFontSizeToggle}
        onStatsModeToggle={handleStatsModeToggle}
        onToggleFontStyle={handleToggleFontStyle}
        onCopyText={handleCopyText}
        onCoffeeClick={handleCoffeeClick}
        visibilityMode={menuVisibilityMode}
        placement={menuPlacement}
        isVisible={isMenuVisible}
        onPointerEnter={handleMenuPointerEnter}
        onPointerLeave={scheduleMenuHide}
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

type EditorWidthDragState = {
  pointerId: number;
  startClientX: number;
  startEditorWidthPercent: number;
  containerWidth: number;
  placement: Exclude<EditorWidthHandlePlacement, 'none'>;
};

const DEFAULT_SPLIT_DRAFT_PERCENT = 50;
const MIN_SPLIT_DRAFT_PERCENT = 15;
const MAX_SPLIT_DRAFT_PERCENT = 85;
const DEFAULT_EDITOR_WIDTH_PERCENT = 100;
const MIN_EDITOR_WIDTH_PERCENT = 55;
const MAX_EDITOR_WIDTH_PERCENT = 100;
const EDITOR_WIDTH_RESIZE_MIN_SCREEN_WIDTH = 640;

const getEditorWidthHandlePlacement = ({
  lineNumberPosition,
  lineNumberVisibilityMode,
  areLineNumbersVisible,
}: {
  lineNumberPosition: LineNumberPosition;
  lineNumberVisibilityMode: LineNumberVisibilityMode;
  areLineNumbersVisible: boolean;
}): EditorWidthHandlePlacement => {
  const shouldShowLineNumbers =
    lineNumberVisibilityMode === 'visible' || areLineNumbersVisible;

  if (!shouldShowLineNumbers) {
    return 'none';
  }

  if (lineNumberPosition === 'right') {
    return 'beforeRightGutter';
  }

  return 'afterLeftGutter';
};

const getEditorWidthHandleTransformClassName = (
  placement: Exclude<EditorWidthHandlePlacement, 'none'>,
): string => {
  if (placement === 'beforeRightGutter') {
    return 'translate-x-0';
  }

  return '-translate-x-full';
};

const getEditorWidthHandleWidthClassName = (): string => {
  return 'w-3';
};

const getEditorWidthHandleLineClassName = (): string => {
  return 'right-0';
};

const getEditorWidthHandleLineColorClassName = (): string => {
  return 'bg-transparent group-hover:bg-[#3A3B3C] group-focus-visible:bg-[#3A3B3C] group-active:bg-[#3A3B3C]';
};

const writeClipboardText = async ({
  plainText,
  htmlText,
}: {
  plainText: string;
  htmlText: string;
}) => {
  if (
    navigator.clipboard.write &&
    typeof window.ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
        }),
      ]);
      return;
    } catch {
      // Fall back to plain-text copy.
    }
  }

  await navigator.clipboard.writeText(plainText);
};
