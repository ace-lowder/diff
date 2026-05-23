import { describe, expect, it } from 'vitest';

import {
  getMenuBorderClassName,
  getMenuEdgeTriggerClassName,
  getMenuLayoutClassName,
  getMenuVisibilityClassName,
} from './menuVisibility';
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

describe('getMenuVisibilityClassName', () => {
  it('returns visible class when mode is visible', () => {
    expect(
      getMenuVisibilityClassName({
        visibilityMode: 'visible',
        isVisible: false,
        placement: 'responsive',
      }),
    ).toBe('translate-y-0');
  });

  it('returns visible class when autoHide mode is currently visible', () => {
    expect(
      getMenuVisibilityClassName({
        visibilityMode: 'autoHide',
        isVisible: true,
        placement: 'responsive',
      }),
    ).toBe('translate-y-0');
  });

  it('returns hidden class when responsive autoHide mode is currently hidden', () => {
    expect(
      getMenuVisibilityClassName({
        visibilityMode: 'autoHide',
        isVisible: false,
        placement: 'responsive',
      }),
    ).toBe('-translate-y-full sm:translate-y-full');
  });

  it('returns hidden class when top autoHide mode is hidden', () => {
    expect(
      getMenuVisibilityClassName({
        visibilityMode: 'autoHide',
        isVisible: false,
        placement: 'top',
      }),
    ).toBe('-translate-y-full');
  });

  it('returns hidden class when bottom autoHide mode is hidden', () => {
    expect(
      getMenuVisibilityClassName({
        visibilityMode: 'autoHide',
        isVisible: false,
        placement: 'bottom',
      }),
    ).toBe('translate-y-full');
  });
});

describe('getMenuLayoutClassName', () => {
  it('returns responsive normal flow classes for visible mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'visible', placement: 'responsive' }),
    ).toBe('relative order-first sm:order-last');
  });

  it('returns top normal flow classes for visible mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'visible', placement: 'top' }),
    ).toBe('relative order-first');
  });

  it('returns bottom normal flow classes for visible mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'visible', placement: 'bottom' }),
    ).toBe('relative order-last');
  });

  it('returns responsive fixed overlay classes for autoHide mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'autoHide', placement: 'responsive' }),
    ).toBe('fixed left-0 right-0 top-0 sm:bottom-0 sm:top-auto');
  });

  it('returns top fixed overlay classes for autoHide mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'autoHide', placement: 'top' }),
    ).toBe('fixed left-0 right-0 top-0');
  });

  it('returns bottom fixed overlay classes for autoHide mode', () => {
    expect(
      getMenuLayoutClassName({ visibilityMode: 'autoHide', placement: 'bottom' }),
    ).toBe('fixed bottom-0 left-0 right-0');
  });
});

describe('getMenuEdgeTriggerClassName', () => {
  it('returns responsive trigger classes', () => {
    expect(
      getMenuEdgeTriggerClassName({ placement: 'responsive' }),
    ).toBe('fixed left-0 top-0 z-40 h-3 w-full sm:bottom-0 sm:top-auto');
  });

  it('returns top trigger classes', () => {
    expect(getMenuEdgeTriggerClassName({ placement: 'top' })).toBe(
      'fixed left-0 top-0 z-40 h-3 w-full',
    );
  });

  it('returns bottom trigger classes', () => {
    expect(getMenuEdgeTriggerClassName({ placement: 'bottom' })).toBe(
      'fixed bottom-0 left-0 z-40 h-3 w-full',
    );
  });
});

describe('getMenuBorderClassName', () => {
  it('returns responsive border classes', () => {
    expect(getMenuBorderClassName({ placement: 'responsive' })).toBe(
      'border-b sm:border-b-0 sm:border-t',
    );
  });

  it('returns top placement border classes', () => {
    expect(getMenuBorderClassName({ placement: 'top' })).toBe('border-b');
  });

  it('returns bottom placement border classes', () => {
    expect(getMenuBorderClassName({ placement: 'bottom' })).toBe('border-t');
  });
});
