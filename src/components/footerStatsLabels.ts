import type { AppMode } from '../appTypes';
import { getWordCount, type EditorStats, type StatsMode } from '../editorDiff';

export type FooterStatsLabels =
  | {
      kind: 'draft';
      baseLabel: string;
    }
  | {
      kind: 'editor';
      baseLabel: string;
      addedLabel: string;
      deletedLabel: string;
    };

export const getFooterStatsLabels = ({
  mode,
  statsMode,
  draftText,
  editorText,
  editorStats,
}: {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorText: string;
  editorStats: EditorStats;
}): FooterStatsLabels => {
  const shouldShowDraftStats =
    mode === 'draft' || (mode === 'split' && editorText.length === 0);

  if (shouldShowDraftStats) {
    return {
      kind: 'draft',
      baseLabel:
        statsMode === 'words' ? `${getWordCount(draftText)}w` : `${draftText.length}c`,
    };
  }

  return {
    kind: 'editor',
    baseLabel:
      statsMode === 'words'
        ? `${editorStats.wordCount}w`
        : `${editorStats.characterCount}c`,
    addedLabel:
      statsMode === 'words'
        ? `+${editorStats.addedWordCount}`
        : `+${editorStats.addedCharacterCount}`,
    deletedLabel:
      statsMode === 'words'
        ? `-${editorStats.deletedWordCount}`
        : `-${editorStats.deletedCharacterCount}`,
  };
};
