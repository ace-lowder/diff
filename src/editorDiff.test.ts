import { describe, expect, it } from 'vitest';

import {
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineDecorations,
  getWordCount,
} from './editorDiff';

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
  it('detects an inserted editor line between matching lines', () => {
    const decorations = getLineDecorations('line 1\nline 3', 'line 1\nline 2\nline 3');

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([{ lineNumber: 2 }]);
  });

  it('detects an inserted blank editor line', () => {
    const decorations = getLineDecorations('line 1\nline 2', 'line 1\n\nline 2');

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([{ lineNumber: 2 }]);
  });

  it('detects editor lines appended after the draft ends', () => {
    const decorations = getLineDecorations('line 1', 'line 1\nline 2');

    expect(decorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(decorations.draftLineDecorations).toEqual([{ lineNumber: 1 }]);
  });

  it('does not create line decorations for ordinary inline edits', () => {
    const decorations = getLineDecorations('one two', 'one three');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });
});
