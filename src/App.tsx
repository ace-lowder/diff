import { useEffect, useMemo, useRef, useState } from 'react';

import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';

import {
  getDisplayChanges,
  getEditorStats,
  getWordCount,
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
};

const CodeMirrorPane = ({
  value,
  onChange,
  ariaLabel,
  theme,
  savedScrollOffset,
  onScrollOffsetChange,
}: CodeMirrorPaneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollOffsetChangeRef = useRef(onScrollOffsetChange);
  const initialValueRef = useRef(value);
  const initialScrollOffsetRef = useRef(savedScrollOffset);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onScrollOffsetChangeRef.current = onScrollOffsetChange;
  }, [onScrollOffsetChange]);

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
      minWidth: '6ch',
      paddingLeft: '0',
      paddingRight: '2ch',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: '#242526',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#242526',
      color: '#BBBEBF',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#264F78 !important',
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
