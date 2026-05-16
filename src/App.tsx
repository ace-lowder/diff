import { useEffect, useMemo, useRef, useState } from 'react';

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
          <TextPane
            value={draftText}
            onChange={setDraftText}
            ariaLabel="Draft text"
            textClassName="text-[#BFBFBF]"
            backgroundClassName="bg-[#191A1B]"
            savedScrollOffset={draftScrollOffset}
            onScrollOffsetChange={setDraftScrollOffset}
          />
        )}

        {mode === 'editor' && (
          <TextPane
            value={editorText}
            onChange={setEditorText}
            ariaLabel="Editor text"
            textClassName="text-[#D4D4D4]"
            backgroundClassName="bg-[#121314]"
            savedScrollOffset={editorScrollOffset}
            onScrollOffsetChange={setEditorScrollOffset}
          />
        )}

        {mode === 'split' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <TextPane
                value={draftText}
                onChange={setDraftText}
                ariaLabel="Draft text"
                textClassName="text-[#BFBFBF]"
                backgroundClassName="bg-[#191A1B]"
                savedScrollOffset={draftScrollOffset}
                onScrollOffsetChange={setDraftScrollOffset}
              />
            </div>
            <div className="h-px bg-[#2A2B2C]" />
            <div className="min-h-0 flex-1">
              <TextPane
                value={editorText}
                onChange={setEditorText}
                ariaLabel="Editor text"
                textClassName="text-[#D4D4D4]"
                backgroundClassName="bg-[#121314]"
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

type TextPaneProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  textClassName: string;
  backgroundClassName: string;
  savedScrollOffset: ScrollOffset;
  onScrollOffsetChange: (scrollOffset: ScrollOffset) => void;
};

const TextPane = ({
  value,
  onChange,
  ariaLabel,
  textClassName,
  backgroundClassName,
  savedScrollOffset,
  onScrollOffsetChange,
}: TextPaneProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (hasRestoredScrollRef.current) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.scrollLeft = savedScrollOffset.left;
    textarea.scrollTop = savedScrollOffset.top;
    hasRestoredScrollRef.current = true;
  }, [savedScrollOffset]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    onScrollOffsetChange({
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
    });
  };

  return (
    <div className={`relative h-full w-full overflow-hidden ${backgroundClassName}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        aria-label={ariaLabel}
        spellCheck={false}
        className={`h-full w-full resize-none border-none bg-transparent ${editorTextClasses} ${textClassName} outline-none caret-[#D4D4D4]`}
        style={{ tabSize: 2 }}
      />
    </div>
  );
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

type ScrollOffset = {
  left: number;
  top: number;
};

// === Constants ===

const editorTextClasses = 'px-3 py-2 font-mono text-base leading-6';

const storageKeys = {
  draftText: 'byline:draftText',
  editorText: 'byline:editorText',
} as const;
