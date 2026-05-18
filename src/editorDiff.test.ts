import { describe, expect, it } from 'vitest';

import {
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getLowestEditedLine,
  getWordCount,
} from './editorDiff';

const getDecorations = (draftText: string, editorText: string) => {
  return getLineDecorations(draftText, editorText);
};

describe('getWordCount', () => {
  it('returns zero for empty text', () => {
    expect(getWordCount('')).toBe(0);
    expect(getWordCount('   ')).toBe(0);
  });

  it('counts one word', () => {
    expect(getWordCount('hello')).toBe(1);
  });

  it('counts multiple words', () => {
    expect(getWordCount('one two\nthree')).toBe(3);
  });
});

describe('getDisplayChanges', () => {
  it('combines inserted words into nearby replacements without highlighting trailing equal spaces', () => {
    const changes = getDisplayChanges('300 men', 'Three hundred men');

    expect(changes).toEqual([
      {
        type: 'replaced',
        draftValue: '300',
        editorValue: 'Three hundred',
      },
      {
        type: 'equal',
        draftValue: ' men',
        editorValue: ' men',
      },
    ]);
  });

  it('does not absorb equal paragraph text into replacement chunks', () => {
    const changes = getDisplayChanges(
      'It started with the 7 of us. I was down here with 5 of my men and a guide.',
      'It started with the seven of us. I was down here with five of my men and a guide.',
    );

    const replacementText = changes
      .filter((change) => change.type === 'replaced')
      .map((change) => `${change.draftValue}|${change.editorValue}`)
      .join('\n');

    expect(replacementText).not.toContain('I was down here with');
    expect(
      changes.some(
        (change) =>
          change.type === 'equal' &&
          change.editorValue.includes('I was down here with'),
      ),
    ).toBe(true);
  });

  it('keeps unchanged sentence text equal around nearby edits', () => {
    const changes = getDisplayChanges(
      'Foreman said they never surfaced. Guess they got lost.',
      'Foreman said they never surfaced. Said they must have gotten lost.',
    );

    expect(
      changes.some(
        (change) =>
          change.type === 'equal' &&
          change.editorValue.includes('Foreman said they never surfaced.'),
      ),
    ).toBe(true);
  });

  it('does not combine replacements across newline boundaries', () => {
    const changes = getDisplayChanges('300\nmen', 'Three hundred\nmen');

    expect(
      changes.some(
        (change) => change.type === 'equal' && change.editorValue.includes('\nmen'),
      ),
    ).toBe(true);
  });
});

describe('getEditorStats', () => {
  it('counts inserted-only text as added', () => {
    const changes = getDisplayChanges('one two', 'one two three');
    const stats = getEditorStats('one two three', changes);

    expect(stats.addedWordCount).toBe(1);
    expect(stats.deletedWordCount).toBe(0);
  });

  it('counts deleted-only text as deleted', () => {
    const changes = getDisplayChanges('one two three', 'one three');
    const stats = getEditorStats('one three', changes);

    expect(stats.deletedWordCount).toBeGreaterThan(0);
    expect(stats.addedWordCount).toBe(0);
  });

  it('counts replacement text as both added and deleted', () => {
    const changes = getDisplayChanges('300 men', 'Three hundred men');
    const stats = getEditorStats('Three hundred men', changes);

    expect(stats.addedWordCount).toBe(2);
    expect(stats.deletedWordCount).toBe(1);
  });
});

describe('getEditorHighlightRanges', () => {
  it('refines typo replacement highlights to changed editor characters', () => {
    const editorText = 'misssing';
    const changes = getDisplayChanges('missing', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toEqual([
      {
        type: 'added',
        from: 4,
        to: 5,
      },
    ]);
    expect(editorText.slice(ranges[0].from, ranges[0].to)).toBe('s');
  });

  it('refines suffix insertion replacement highlights to changed editor characters', () => {
    const editorText = 'words';
    const changes = getDisplayChanges('word', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toEqual([
      {
        type: 'added',
        from: 4,
        to: 5,
      },
    ]);
    expect(editorText.slice(ranges[0].from, ranges[0].to)).toBe('s');
  });

  it('does not highlight remaining editor text for deletion-only refined replacements', () => {
    const editorText = 'ming';
    const changes = getDisplayChanges('missing', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(
      ranges.some(
        (range) =>
          range.type === 'added' &&
          editorText.slice(range.from, range.to) === editorText,
      ),
    ).toBe(false);
    expect(ranges.some((range) => range.type === 'added')).toBe(false);
  });

  it('maps inserted editor text to an added highlight range', () => {
    const changes = getDisplayChanges('one two', 'one two three');
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges.some((range) => range.type === 'added' && range.to > range.from)).toBe(
      true,
    );
  });

  it('maps deleted draft text to a zero-width deletion marker range', () => {
    const changes = getDisplayChanges('one two three', 'one three');
    const ranges = getEditorHighlightRanges(changes);

    expect(
      ranges.some(
        (range) =>
          range.type === 'deleted' &&
          range.from === range.to &&
          range.from >= 0,
      ),
    ).toBe(true);
  });

  it('anchors deleted markers before a preceding editor space when text is removed between words', () => {
    const editorText = 'one three';
    const changes = getDisplayChanges('one two three', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toContainEqual({
      type: 'deleted',
      from: 'one'.length,
      to: 'one'.length,
    });
  });

  it('anchors deleted markers before the next word separator in sentence edits', () => {
    const editorText = 'how many went down here';
    const changes = getDisplayChanges(
      'how many went missing down here',
      editorText,
    );
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toContainEqual({
      type: 'deleted',
      from: 'how many went'.length,
      to: 'how many went'.length,
    });
  });

  it('maps replacement text to one added editor range without deleted marker', () => {
    const changes = getDisplayChanges('300 men', 'Three hundred men');
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toEqual([
      {
        type: 'added',
        from: 0,
        to: 'Three hundred'.length,
      },
    ]);
  });

  it('keeps highlight ranges in editor document order', () => {
    const changes = getDisplayChanges('a b c d', 'a bee c dee');
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges).toEqual(
      [...ranges].sort((left, right) => left.from - right.from || left.to - right.to),
    );
  });

  it('merges added editor ranges across a single plain space', () => {
    const editorText =
      'He volunteered, which meant he was stupid, brave, or desperate.';
    const changes = getDisplayChanges('He volunteered.', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(
      ranges.some(
        (range) =>
          range.type === 'added' &&
          editorText
            .slice(range.from, range.to)
            .includes('which meant he was stupid, brave, or desperate'),
      ),
    ).toBe(true);
  });

  it('does not merge added ranges across newlines', () => {
    const editorText = 'one added\nmore added';
    const changes = getDisplayChanges('one\nmore', editorText);
    const ranges = getEditorHighlightRanges(changes);

    const addedRanges = ranges.filter((range) => range.type === 'added');

    expect(
      addedRanges.some((range) => editorText.slice(range.from, range.to).includes('\n')),
    ).toBe(false);
  });
});

describe('getLineDecorations', () => {
  it('does not mark similar edited lines as inserted lines', () => {
    const decorations = getLineDecorations('this is a test', 'this is a');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('detects an inserted blank editor line between similar lines', () => {
    const decorations = getLineDecorations('this is a test\none', 'this is a\n\none');

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 2,
      placement: 'before',
      lineCount: 1,
    });
  });

  it('detects a true inserted editor line', () => {
    const decorations = getLineDecorations(
      'line one\nline three',
      'line one\nline two\nline three',
    );

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
  });

  it('places an inserted editor line before the matching following draft line', () => {
    const decorations = getDecorations('line 1\nline 3', 'line 1\nline 2\nline 3');

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
  });

  it('detects an inserted blank editor line from display changes', () => {
    const decorations = getDecorations('one\ntwo', 'one\n\ntwo');

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
  });

  it('detects inserted editor lines when nearby text is also edited', () => {
    const decorations = getDecorations(
      'this is a test\none\ntwo\nthree\n10',
      'this is a test.\none\n\ntwo',
    );

    expect(decorations.editorLineDecorations.length).toBeGreaterThan(0);
    expect(decorations.draftLineDecorations.length).toBeGreaterThan(0);
  });

  it('detects appended editor lines when draft is empty', () => {
    const decorations = getDecorations('', 'anything');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('detects multiline editor insertion when draft is empty', () => {
    const decorations = getDecorations('', 'anything\nnew line');

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 1,
      placement: 'after',
      lineCount: 1,
    });
  });

  it('does not create line decorations for ordinary inline edits', () => {
    const decorations = getDecorations('one two', 'one three');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('places an appended editor line after the final draft line', () => {
    const decorations = getLineDecorations(
      'line 1\nline 2',
      'line 1\nline 2\nline 3',
    );

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 3 }]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'after',
        lineCount: 1,
      },
    ]);
  });

  it('marks draft-only lines as deleted draft lines', () => {
    const decorations = getLineDecorations('one\ntwo\nthree', 'one\nthree');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'deletedDraftLine',
        lineNumber: 2,
        placement: 'before',
      },
    ]);
  });

  it('keeps similar edited lines paired instead of treating them as inserted lines', () => {
    const decorations = getLineDecorations('this is a test', 'this is a');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('uses lookahead to keep missing editor placeholders in the correct draft gap', () => {
    const decorations = getLineDecorations(
      'this is a test\none\ntwo\nthree',
      'this is a test\none\ntwo\n\nthree',
    );

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 4 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 4,
      placement: 'before',
      lineCount: 1,
    });
  });

  it('aggregates multiple blank editor-only lines in the same draft gap', () => {
    const decorations = getLineDecorations('one\ntwo', 'one\n\n\ntwo');

    expect(decorations.editorLineDecorations).toEqual([
      { lineNumber: 2 },
      { lineNumber: 3 },
    ]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 2,
      },
    ]);
  });

  it('aggregates multiple appended editor-only lines after final draft line', () => {
    const decorations = getLineDecorations('one', 'one\ntwo\nthree');

    expect(decorations.editorLineDecorations).toEqual([
      { lineNumber: 2 },
      { lineNumber: 3 },
    ]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 1,
        placement: 'after',
        lineCount: 2,
      },
    ]);
  });

  it('matches long inserted editor blocks beyond prior lookahead cap', () => {
    const decorations = getLineDecorations(
      'start\nend',
      'start\none\ntwo\nthree\nfour\nfive\nend',
    );

    expect(decorations.editorLineDecorations).toEqual([
      { lineNumber: 2 },
      { lineNumber: 3 },
      { lineNumber: 4 },
      { lineNumber: 5 },
      { lineNumber: 6 },
    ]);
    expect(decorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 5,
      },
    ]);
    expect(
      decorations.draftLineDecorations.some(
        (decoration) => decoration.type === 'deletedDraftLine',
      ),
    ).toBe(false);
  });

  it('deleting a blank line does not invent editor insertions when later blank lines exist', () => {
    const decorations = getLineDecorations(
      'Title\n\nFirst paragraph.\n\nSecond paragraph.',
      'Title\nFirst paragraph.\n\nSecond paragraph.',
    );

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(
      decorations.draftLineDecorations.filter(
        (decoration) => decoration.type === 'deletedDraftLine',
      ),
    ).toEqual([
      {
        type: 'deletedDraftLine',
        lineNumber: 2,
        placement: 'before',
      },
    ]);
    expect(
      decorations.draftLineDecorations.some(
        (decoration) => decoration.type === 'missingEditorLine',
      ),
    ).toBe(false);
  });

  it('deleting first blank line after title marks only that draft line as deleted', () => {
    const decorations = getLineDecorations(
      'Down Under\n\n300 men, that’s how many went missing down here.',
      'Down Under\n300 men, that’s how many went missing down here.',
    );

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(
      decorations.draftLineDecorations.filter(
        (decoration) => decoration.type === 'deletedDraftLine',
      ),
    ).toEqual([
      {
        type: 'deletedDraftLine',
        lineNumber: 2,
        placement: 'before',
      },
    ]);
  });
});

describe('getDraftHighlightRanges', () => {
  it('refines typo replacement highlights to changed draft characters', () => {
    const draftText = 'misssing';
    const changes = getDisplayChanges(draftText, 'missing');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toEqual([{ type: 'deleted', from: 2, to: 3 }]);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toBe('s');
  });

  it('uses deletion-biased refinement for duplicate-letter deletions', () => {
    const draftText = 'missing';
    const changes = getDisplayChanges(draftText, 'ming');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toEqual([{ type: 'deleted', from: 1, to: 4 }]);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toBe('iss');
  });

  it('maps replacement draft text to a deleted highlight range', () => {
    const draftText = '300 men';
    const changes = getDisplayChanges(draftText, 'Three hundred men');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toEqual([{ type: 'deleted', from: 0, to: 3 }]);
  });

  it('maps deleted draft text to deleted highlight ranges', () => {
    const draftText = 'one two three';
    const changes = getDisplayChanges(draftText, 'one three');
    const ranges = getDraftHighlightRanges(changes);

    expect(
      ranges.some((range) => draftText.slice(range.from, range.to).includes('two')),
    ).toBe(true);
  });

  it('keeps large replacements as full draft replacement highlights', () => {
    const draftText = '300 men';
    const editorText = 'Three hundred men';
    const changes = getDisplayChanges(draftText, editorText);
    const editorRanges = getEditorHighlightRanges(changes);
    const draftRanges = getDraftHighlightRanges(changes);

    expect(editorRanges).toEqual([
      {
        type: 'added',
        from: 0,
        to: 'Three hundred'.length,
      },
    ]);
    expect(editorText.slice(editorRanges[0].from, editorRanges[0].to)).toBe(
      'Three hundred',
    );
    expect(draftRanges).toEqual([{ type: 'deleted', from: 0, to: 3 }]);
    expect(draftText.slice(draftRanges[0].from, draftRanges[0].to)).toBe('300');
  });

  it('keeps draft highlight ranges in draft document order', () => {
    const changes = getDisplayChanges('a b c d', 'a bee c dee');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toEqual(
      [...ranges].sort((left, right) => left.from - right.from || left.to - right.to),
    );
  });

  it('does not drift draft highlight offsets after refined replacements', () => {
    const draftText = 'misssing\nword';
    const editorText = 'missing\nchanged';
    const changes = getDisplayChanges(draftText, editorText);
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toEqual([
      { type: 'deleted', from: 2, to: 3 },
      { type: 'deleted', from: 9, to: 12 },
    ]);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toBe('s');
    expect(draftText.slice(ranges[1].from, ranges[1].to)).toBe('wor');
  });
});

describe('getLowestEditedLine', () => {
  it('returns null when there are no edits', () => {
    const changes = getDisplayChanges('one\ntwo', 'one\ntwo');

    expect(getLowestEditedLine(changes)).toBeNull();
  });

  it('returns the deepest editor line containing an inline edit', () => {
    const changes = getDisplayChanges('one\ntwo\nthree', 'one\ntwo changed\nthree');

    expect(getLowestEditedLine(changes)).toEqual({ lineNumber: 2 });
  });

  it('returns the deepest editor line containing an inserted line', () => {
    const changes = getDisplayChanges('one\nthree', 'one\ntwo\nthree');

    expect(getLowestEditedLine(changes)).toEqual({ lineNumber: 2 });
  });
});
