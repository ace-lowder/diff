import { describe, expect, it } from 'vitest';

import { getFooterStatsLabels } from './footerStatsLabels';

const editorStats = {
  wordCount: 3,
  characterCount: 14,
  addedWordCount: 1,
  deletedWordCount: 2,
  addedCharacterCount: 5,
  deletedCharacterCount: 7,
};

describe('getFooterStatsLabels', () => {
  it('draft mode shows draft word count when editor has content', () => {
    expect(
      getFooterStatsLabels({
        mode: 'draft',
        statsMode: 'words',
        draftText: 'one two three',
        editorText: 'editor content',
        editorStats,
      }),
    ).toEqual({ kind: 'draft', baseLabel: '3w' });
  });

  it('draft mode shows draft character count', () => {
    expect(
      getFooterStatsLabels({
        mode: 'draft',
        statsMode: 'characters',
        draftText: 'abc',
        editorText: 'editor content',
        editorStats,
      }),
    ).toEqual({ kind: 'draft', baseLabel: '3c' });
  });

  it('editor mode shows editor base and deltas', () => {
    expect(
      getFooterStatsLabels({
        mode: 'editor',
        statsMode: 'words',
        draftText: 'one two three',
        editorText: '',
        editorStats,
      }),
    ).toEqual({
      kind: 'editor',
      baseLabel: '3w',
      addedLabel: '+1',
      deletedLabel: '-2',
    });
  });

  it('split mode with empty editor shows draft word count only', () => {
    expect(
      getFooterStatsLabels({
        mode: 'split',
        statsMode: 'words',
        draftText: 'one two three',
        editorText: '',
        editorStats,
      }),
    ).toEqual({ kind: 'draft', baseLabel: '3w' });
  });

  it('split mode with empty editor shows draft character count only', () => {
    expect(
      getFooterStatsLabels({
        mode: 'split',
        statsMode: 'characters',
        draftText: 'abcd',
        editorText: '',
        editorStats,
      }),
    ).toEqual({ kind: 'draft', baseLabel: '4c' });
  });

  it('split mode with non-empty editor shows editor base and deltas', () => {
    expect(
      getFooterStatsLabels({
        mode: 'split',
        statsMode: 'characters',
        draftText: 'draft',
        editorText: 'editor',
        editorStats,
      }),
    ).toEqual({
      kind: 'editor',
      baseLabel: '14c',
      addedLabel: '+5',
      deletedLabel: '-7',
    });
  });

  it('split mode with whitespace editor text shows editor base and deltas', () => {
    expect(
      getFooterStatsLabels({
        mode: 'split',
        statsMode: 'words',
        draftText: 'one two',
        editorText: '\n ',
        editorStats,
      }),
    ).toEqual({
      kind: 'editor',
      baseLabel: '3w',
      addedLabel: '+1',
      deletedLabel: '-2',
    });
  });
});
