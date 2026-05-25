import { describe, expect, it } from 'vitest';

import {
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineAnchoredDraftHighlightRanges,
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
      draftHighlightRanges: getLineAnchoredDraftHighlightRanges({
        draftText,
        editorText,
      }),
      lineDecorations: getLineDecorations(draftText, editorText),
      lowestEditedLine: getLowestEditedLine(displayChanges),
      editorStats: getEditorStats(editorText, displayChanges),
    });
  });
});
