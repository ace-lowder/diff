import { useEffect, useMemo, useRef, useState } from 'react';

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
  type DecorationSet,
} from '@codemirror/view';

import {
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
  getWordCount,
  type DraftLineDecoration,
  type EditorHighlightRange,
  type EditorLineDecoration,
  type LowestEditedLine,
  type EditorStats,
  type StatsMode,
} from './editorDiff';

const App = () => {
  const [mode, setMode] = useState<AppMode>('split');
  const [statsMode, setStatsMode] = useState<StatsMode>('words');
  const [draftText, setDraftText] = useState(() =>
    getStoredText(storageKeys.draftText),
  );
  const [editorText, setEditorText] = useState(() =>
    getStoredText(storageKeys.editorText),
  );
  const [draftScrollOffset, setDraftScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });
  const [editorScrollOffset, setEditorScrollOffset] = useState<ScrollOffset>({
    left: 0,
    top: 0,
  });

  const displayChanges = useMemo(() => {
    return getDisplayChanges(draftText, editorText);
  }, [draftText, editorText]);

  const editorHighlightRanges = useMemo(() => {
    return getEditorHighlightRanges(displayChanges);
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

  const handleModeToggle = () => {
    setMode((currentMode) => getNextMode(currentMode));
  };

  const handleStatsModeToggle = () => {
    setStatsMode((currentStatsMode) => getNextStatsMode(currentStatsMode));
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#121314] text-[#D4D4D4]">
      <main className="min-h-0 flex-1">
        {mode === 'draft' && (
          <CodeMirrorPane
            value={draftText}
            onChange={setDraftText}
            ariaLabel="Draft text"
            theme="draft"
            savedScrollOffset={draftScrollOffset}
            onScrollOffsetChange={setDraftScrollOffset}
            draftLineDecorations={lineDecorations.draftLineDecorations}
          />
        )}

        {mode === 'editor' && (
          <CodeMirrorPane
            value={editorText}
            onChange={setEditorText}
            ariaLabel="Editor text"
            theme="editor"
            savedScrollOffset={editorScrollOffset}
            onScrollOffsetChange={setEditorScrollOffset}
            highlightRanges={editorHighlightRanges}
            editorLineDecorations={lineDecorations.editorLineDecorations}
            lowestEditedLine={lowestEditedLine}
          />
        )}

        {mode === 'split' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <CodeMirrorPane
                value={draftText}
                onChange={setDraftText}
                ariaLabel="Draft text"
                theme="draft"
                savedScrollOffset={draftScrollOffset}
                onScrollOffsetChange={setDraftScrollOffset}
                draftLineDecorations={lineDecorations.draftLineDecorations}
              />
            </div>
            <div className="h-px bg-[#2A2B2C]" />
            <div className="min-h-0 flex-1">
              <CodeMirrorPane
                value={editorText}
                onChange={setEditorText}
                ariaLabel="Editor text"
                theme="editor"
                savedScrollOffset={editorScrollOffset}
                onScrollOffsetChange={setEditorScrollOffset}
                highlightRanges={editorHighlightRanges}
                editorLineDecorations={lineDecorations.editorLineDecorations}
                lowestEditedLine={lowestEditedLine}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex h-8 shrink-0 items-center border-t border-[#2A2B2C] bg-[#191A1B] text-sm">
        <button
          type="button"
          onClick={handleModeToggle}
          className="flex h-full w-14 items-center border-r border-[#2A2B2C] px-2 text-left text-xs font-medium text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
        >
          {getModeLabel(mode)}
        </button>

        <FooterStats
          mode={mode}
          statsMode={statsMode}
          draftText={draftText}
          editorStats={editorStats}
          onToggle={handleStatsModeToggle}
        />
      </footer>
    </div>
  );
};

export default App;

// === Components ===

type CodeMirrorPaneProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  theme: CodeMirrorTheme;
  savedScrollOffset: ScrollOffset;
  onScrollOffsetChange: (scrollOffset: ScrollOffset) => void;
  highlightRanges?: EditorHighlightRange[];
  editorLineDecorations?: EditorLineDecoration[];
  draftLineDecorations?: DraftLineDecoration[];
  lowestEditedLine?: LowestEditedLine | null;
};

const CodeMirrorPane = ({
  value,
  onChange,
  ariaLabel,
  theme,
  savedScrollOffset,
  onScrollOffsetChange,
  highlightRanges,
  editorLineDecorations,
  draftLineDecorations,
  lowestEditedLine,
}: CodeMirrorPaneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollOffsetChangeRef = useRef(onScrollOffsetChange);
  const initialValueRef = useRef(value);
  const initialScrollOffsetRef = useRef(savedScrollOffset);
  const decorationsRef = useRef<CodeMirrorDecorations>(
    getCodeMirrorDecorationsInput({
      highlightRanges,
      editorLineDecorations,
      draftLineDecorations,
      lowestEditedLine,
    }),
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onScrollOffsetChangeRef.current = onScrollOffsetChange;
  }, [onScrollOffsetChange]);

  useEffect(() => {
    decorationsRef.current = getCodeMirrorDecorationsInput({
      highlightRanges,
      editorLineDecorations,
      draftLineDecorations,
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
  }, [draftLineDecorations, editorLineDecorations, highlightRanges, lowestEditedLine]);

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
          onChange: (nextValue) => onChangeRef.current(nextValue),
          onScroll: (nextScrollOffset) =>
            onScrollOffsetChangeRef.current(nextScrollOffset),
        }),
      }),
    });

    editorViewRef.current = editorView;
    editorView.scrollDOM.scrollLeft = initialScrollOffsetRef.current.left;
    editorView.scrollDOM.scrollTop = initialScrollOffsetRef.current.top;
    editorView.dispatch({
      effects: setEditorDecorationsEffect.of(
        getCodeMirrorDecorations(editorView, decorationsRef.current),
      ),
    });

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
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

// === Helpers ===

type CodeMirrorExtensionOptions = {
  ariaLabel: string;
  theme: CodeMirrorTheme;
  onChange: (value: string) => void;
  onScroll: (scrollOffset: ScrollOffset) => void;
};

type CodeMirrorDecorations = {
  highlightRanges: EditorHighlightRange[];
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
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
  toDOM() {
    const line = document.createElement('div');

    line.className = 'byline-missing-line';
    line.setAttribute('aria-hidden', 'true');

    return line;
  }

  ignoreEvent() {
    return true;
  }
}

const getCodeMirrorDecorationsInput = ({
  highlightRanges,
  editorLineDecorations,
  draftLineDecorations,
  lowestEditedLine,
}: {
  highlightRanges?: EditorHighlightRange[];
  editorLineDecorations?: EditorLineDecoration[];
  draftLineDecorations?: DraftLineDecoration[];
  lowestEditedLine?: LowestEditedLine | null;
}): CodeMirrorDecorations => {
  return {
    highlightRanges: highlightRanges ?? [],
    editorLineDecorations: editorLineDecorations ?? [],
    draftLineDecorations: draftLineDecorations ?? [],
    lowestEditedLine: lowestEditedLine ?? null,
  };
};

const getCodeMirrorDecorations = (
  editorView: EditorView,
  decorations: CodeMirrorDecorations,
): DecorationSet => {
  const ranges: Range<Decoration>[] = [
    ...getEditorHighlightDecorations(decorations.highlightRanges),
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
    const lineNumber = Math.min(
      Math.max(1, decoration.lineNumber),
      editorView.state.doc.lines,
    );
    const line = editorView.state.doc.line(lineNumber);

    decorations.push(
      Decoration.widget({
        block: true,
        side: -1,
        widget: new MissingLineWidget(),
      }).range(line.from),
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

const getCodeMirrorExtensions = ({
  ariaLabel,
  theme,
  onChange,
  onScroll,
}: CodeMirrorExtensionOptions): Extension[] => {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': ariaLabel,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }

      onChange(update.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      scroll: (_event, view) => {
        onScroll({
          left: view.scrollDOM.scrollLeft,
          top: view.scrollDOM.scrollTop,
        });
      },
    }),
    editorDecorationsField,
    getCodeMirrorTheme(theme),
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
      height: '1.5em',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(140, 140, 140, 0.7) 0, rgba(140, 140, 140, 0.7) 2px, transparent 2px, transparent 6px)',
    },
    '.cm-line.byline-lowest-edited-line': {
      borderBottom: '1px dashed #8C8C8C',
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

// === Types ===

type AppMode = 'draft' | 'editor' | 'split';

type CodeMirrorTheme = 'draft' | 'editor';

type ScrollOffset = {
  left: number;
  top: number;
};

// === Constants ===

const storageKeys = {
  draftText: 'byline:draftText',
  editorText: 'byline:editorText',
} as const;
