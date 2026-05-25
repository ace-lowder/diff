import { describe, expect, it } from 'vitest';

import {
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
} from './editorDiff';
import { getEditorDiffState } from './editorDiffState';

describe('getEditorDiffState', () => {
  it('matches direct helper outputs', () => {
    const draftText = 'One line\nSecond line';
    const editorText = 'One revised line\nSecond line';
    const displayChanges = getDisplayChanges(draftText, editorText);

    expect(getEditorDiffState({ draftText, editorText })).toEqual({
      displayChanges,
      editorHighlightRanges: getEditorHighlightRanges(displayChanges),
      draftHighlightRanges: getDraftHighlightRanges(displayChanges),
      lineDecorations: getLineDecorations(draftText, editorText),
      lowestEditedLine: getLowestEditedLine(displayChanges),
      editorStats: getEditorStats(editorText, displayChanges),
    });
  });
});
