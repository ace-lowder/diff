import { describe, expect, it } from 'vitest';

import {
  type DraftHighlightRange,
  type EditorHighlightRange,
  getDraftHighlightRanges,
  getDisplayChanges,
  getEditorHighlightRanges,
  getEditorStats,
  getLineAnchoredDiffResult,
  getLineAnchoredEditorHighlightRanges,
  getLineAnchoredDraftHighlightRanges,
  getLineDecorations,
  getLowestEditedLine,
  getWordCount,
} from './editorDiff';

const getDecorations = (draftText: string, editorText: string) => {
  return getLineDecorations(draftText, editorText);
};

const getEditorSlices = (editorText: string, ranges: EditorHighlightRange[]) =>
  ranges.map((range) => editorText.slice(range.from, range.to));

const getDraftSlices = (draftText: string, ranges: DraftHighlightRange[]) =>
  ranges.map((range) => draftText.slice(range.from, range.to));

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

  it('collapses noisy sentence rewrites instead of matching tiny common fragments', () => {
    const draftText = 'That’s why he volunteered. Think his name was Pablo.';
    const editorText =
      "I keep wanting to call him Pablo. Maybe that was his name, I can't remember.";
    const changes = getDisplayChanges(draftText, editorText);

    expect(changes).toEqual([
      {
        type: 'replaced',
        draftValue: draftText,
        editorValue: editorText,
      },
    ]);
  });

  it('keeps draft/editor reconstruction invariant for inserted line before joined text', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nabc\ntwo three';
    const changes = getDisplayChanges(draftText, editorText);

    expect(changes.map((change) => change.draftValue).join('')).toBe(draftText);
    expect(changes.map((change) => change.editorValue).join('')).toBe(editorText);
  });

  it('keeps draft/editor reconstruction invariant for inserted line before joined text with suffix deletion', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nabc\ntwo thre';
    const changes = getDisplayChanges(draftText, editorText);

    expect(changes.map((change) => change.draftValue).join('')).toBe(draftText);
    expect(changes.map((change) => change.editorValue).join('')).toBe(editorText);
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

  it('merges editor added ranges across punctuation and spaces', () => {
    const draftText = 'one old. old two';
    const editorText = 'one test. test two';
    const changes = getDisplayChanges(draftText, editorText);
    const slices = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to));

    expect(slices).toContain('test. test');
  });

  it('merges editor added ranges across exclamation punctuation and spaces', () => {
    const draftText = 'one old! old two';
    const editorText = 'one test! test two';
    const changes = getDisplayChanges(draftText, editorText);
    const slices = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to));

    expect(slices).toContain('test! test');
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

  it('refines case and punctuation replacement highlights', () => {
    const editorText = 'Welcome to Byline!';
    const changes = getDisplayChanges('Welcome to byline', editorText);
    const ranges = getEditorHighlightRanges(changes);

    expect(ranges.map((range) => editorText.slice(range.from, range.to))).toEqual([
      'B',
      '!',
    ]);
  });

  it('highlights full words for substantial single-word replacements', () => {
    const cases = [
      { draftText: 'drafts', editorText: 'edits' },
      { draftText: 'test', editorText: 'tats' },
      { draftText: 'test', editorText: 'molest' },
      { draftText: 'test', editorText: 'tesla' },
    ];

    for (const testCase of cases) {
      const changes = getDisplayChanges(testCase.draftText, testCase.editorText);
      const editorAdded = getEditorHighlightRanges(changes)
        .filter((range) => range.type === 'added')
        .map((range) => testCase.editorText.slice(range.from, range.to));
      const draftDeleted = getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => testCase.draftText.slice(range.from, range.to));

      expect(editorAdded).toContain(testCase.editorText);
      expect(draftDeleted).toContain(testCase.draftText);
    }
  });

  it('keeps punctuation/case/trailing-s heavy replacements character-level', () => {
    const bylineWithPunctuation = getDisplayChanges('byline', 'Byline!');
    const bylinePunctuationAdded = getEditorHighlightRanges(bylineWithPunctuation)
      .filter((range) => range.type === 'added')
      .map((range) => 'Byline!'.slice(range.from, range.to));
    expect(bylinePunctuationAdded).toEqual(['B', '!']);
    expect(bylinePunctuationAdded).not.toContain('Byline!');

    const bylineBolinesPunctuation = getDisplayChanges('byline', 'Bolines!');
    const bolinesPunctuationAdded = getEditorHighlightRanges(bylineBolinesPunctuation)
      .filter((range) => range.type === 'added')
      .map((range) => 'Bolines!'.slice(range.from, range.to));
    const bolinesPunctuationDeleted = getDraftHighlightRanges(bylineBolinesPunctuation)
      .filter((range) => range.type === 'deleted')
      .map((range) => 'byline'.slice(range.from, range.to));
    expect(bolinesPunctuationAdded).not.toContain('Bolines!');
    expect(bolinesPunctuationDeleted).not.toContain('byline');

    const bylineBolines = getDisplayChanges('byline', 'Bolines');
    const bolinesAdded = getEditorHighlightRanges(bylineBolines)
      .filter((range) => range.type === 'added')
      .map((range) => 'Bolines'.slice(range.from, range.to));
    const bolinesDeleted = getDraftHighlightRanges(bylineBolines)
      .filter((range) => range.type === 'deleted')
      .map((range) => 'byline'.slice(range.from, range.to));
    expect(bolinesAdded).not.toContain('Bolines');
    expect(bolinesDeleted).not.toContain('byline');

    const teests = getDisplayChanges('test', 'Teests');
    const teestsAdded = getEditorHighlightRanges(teests)
      .filter((range) => range.type === 'added')
      .map((range) => 'Teests'.slice(range.from, range.to));
    const teestsDeleted = getDraftHighlightRanges(teests)
      .filter((range) => range.type === 'deleted')
      .map((range) => 'test'.slice(range.from, range.to));
    expect(teestsAdded).not.toContain('Teests');
    expect(teestsDeleted).not.toContain('test');

    const wrappedByline = getDisplayChanges('byline', '*byline*');
    const wrappedBylineAdded = getEditorHighlightRanges(wrappedByline)
      .filter((range) => range.type === 'added')
      .map((range) => '*byline*'.slice(range.from, range.to));
    expect(wrappedBylineAdded).toEqual(['*', '*']);
    expect(wrappedBylineAdded).not.toContain('*byline*');
  });

  it('keeps pure word-edge additions character-level', () => {
    const cases = [
      { draftText: 'test', editorText: 'tester', expectedSlice: 'er' },
      { draftText: 'test', editorText: 'testing', expectedSlice: 'ing' },
      { draftText: 'test', editorText: 'backtest', expectedSlice: 'back' },
    ];

    for (const testCase of cases) {
      const changes = getDisplayChanges(testCase.draftText, testCase.editorText);
      const editorAdded = getEditorHighlightRanges(changes)
        .filter((range) => range.type === 'added')
        .map((range) => testCase.editorText.slice(range.from, range.to));
      const draftDeleted = getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => testCase.draftText.slice(range.from, range.to));

      expect(editorAdded).toContain(testCase.expectedSlice);
      expect(draftDeleted).not.toContain(testCase.draftText);
    }
  });

  it('refines same-token character substitutions', () => {
    const draftText = 'drafts';
    const editorText = 'drufts';
    const changes = getDisplayChanges(draftText, editorText);

    expect(
      getEditorHighlightRanges(changes).map((range) =>
        editorText.slice(range.from, range.to),
      ),
    ).toEqual(['u']);

    expect(
      getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => draftText.slice(range.from, range.to)),
    ).toEqual(['a']);
  });

  it('does not refine unrelated semantic replacements', () => {
    const draftText = 'messy';
    const editorText = 'polished';
    const changes = getDisplayChanges(draftText, editorText);

    expect(
      getEditorHighlightRanges(changes).map((range) =>
        editorText.slice(range.from, range.to),
      ),
    ).toEqual(['polished']);

    expect(
      getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => draftText.slice(range.from, range.to)),
    ).toEqual(['messy']);
  });

  it('refines same-token edits after unchanged words', () => {
    const draftText = 'test drafts';
    const editorText = 'test drufts';
    const changes = getDisplayChanges(draftText, editorText);

    expect(
      getEditorHighlightRanges(changes)
        .filter((range) => range.type === 'added')
        .map((range) => editorText.slice(range.from, range.to)),
    ).toEqual(['u']);

    expect(
      getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => draftText.slice(range.from, range.to)),
    ).toEqual(['a']);
  });

  it('refines same-token edits inside larger replacements', () => {
    const draftText = 'messy drafts';
    const editorText = 'polished drufts';
    const changes = getDisplayChanges(draftText, editorText);

    const editorSlices = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to));
    const draftSlices = getDraftHighlightRanges(changes)
      .filter((range) => range.type === 'deleted')
      .map((range) => draftText.slice(range.from, range.to));

    expect(editorSlices).toContain('polished');
    expect(editorSlices).toContain('u');
    expect(draftSlices).toContain('messy');
    expect(draftSlices).toContain('a');
  });

  it('highlights only inserted words between equal words', () => {
    const draftText = 'test drafts';
    const editorText = 'test new drafts';
    const changes = getDisplayChanges(draftText, editorText);

    expect(
      getEditorHighlightRanges(changes)
        .filter((range) => range.type === 'added')
        .map((range) => editorText.slice(range.from, range.to)),
    ).toEqual([' new']);
    expect(getDraftHighlightRanges(changes)).toContainEqual({
      type: 'added',
      from: 4,
      to: 4,
    });
  });

  it('deletes only the prefix character before a word', () => {
    const draftText = 'tThis is the DRAFT view';
    const editorText = 'This is the EDITOR view';
    const changes = getDisplayChanges(draftText, editorText);
    const draftDeletedSlices = getDraftHighlightRanges(changes).map((range) =>
      draftText.slice(range.from, range.to),
    );
    const editorAddedSlices = getEditorHighlightRanges(changes).map((range) =>
      editorText.slice(range.from, range.to),
    );
    const visibleEditorAddedSlices = editorAddedSlices.filter((slice) => slice.length > 0);

    expect(draftDeletedSlices).toContain('t');
    expect(visibleEditorAddedSlices).not.toContain('T');
    expect(getEditorHighlightRanges(changes).some((range) => range.from === range.to)).toBe(
      true,
    );
  });

  it('deletes only prefix before numbered line', () => {
    const draftText = 't1.';
    const editorText = '1. two';
    const changes = getDisplayChanges(draftText, editorText);

    const draftDeletedSlices = getDraftHighlightRanges(changes)
      .filter((range) => range.type === 'deleted')
      .map((range) => draftText.slice(range.from, range.to));
    const editorAddedSlices = getEditorHighlightRanges(changes).map((range) =>
      editorText.slice(range.from, range.to),
    );
    const visibleEditorAddedSlices = editorAddedSlices.filter((slice) => slice.length > 0);

    expect(draftDeletedSlices).toContain('t');
    expect(draftDeletedSlices).not.toContain('1');
    expect(visibleEditorAddedSlices).toEqual([' two']);
    expect(visibleEditorAddedSlices).not.toContain('1');
    expect(getEditorHighlightRanges(changes).some((range) => range.from === range.to)).toBe(
      true,
    );
  });

  it('does not highlight surviving numbered prefixes as additions', () => {
    const draftText = 't1. Updates are highlighted red';
    const editorText = '1. Updates are highlighted green';
    const changes = getDisplayChanges(draftText, editorText);
    const draftDeletedRanges = getDraftHighlightRanges(changes);
    const draftDeletedSlices = draftDeletedRanges.map((range) =>
      draftText.slice(range.from, range.to),
    );
    const editorAddedSlices = getEditorHighlightRanges(changes).map((range) =>
      editorText.slice(range.from, range.to),
    );

    expect(
      draftDeletedRanges.some((range) => range.type === 'deleted' && range.from === 0 && range.to === 1),
    ).toBe(true);
    expect(draftDeletedSlices.some((slice) => slice.includes('1'))).toBe(false);
    expect(editorAddedSlices).not.toContain('1');
    expect(getEditorHighlightRanges(changes).some((range) => range.from === range.to)).toBe(
      true,
    );
  });

  it('highlights same-token replacement plus suffix insertion precisely', () => {
    const draftText = 'draft';
    const editorText = 'drufts';
    const changes = getDisplayChanges(draftText, editorText);

    expect(
      getDraftHighlightRanges(changes)
        .filter((range) => range.type === 'deleted')
        .map((range) => draftText.slice(range.from, range.to)),
    ).toEqual(['a']);

    expect(
      getEditorHighlightRanges(changes)
        .filter((range) => range.type === 'added')
        .map((range) => editorText.slice(range.from, range.to)),
    ).toEqual(['u', 's']);
  });

  it('highlights inserted word with leading space before an existing separator', () => {
    const draftText = 'one three';
    const editorText = 'one new three';
    const changes = getDisplayChanges(draftText, editorText);

    const editorSlices = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to));

    expect(editorSlices).toEqual([' new']);
    expect(editorSlices).not.toContain('new ');
    expect(getDraftHighlightRanges(changes)).toContainEqual({
      type: 'added',
      from: 3,
      to: 3,
    });
  });

  it('keeps repeated words matched instead of highlighting survivors', () => {
    const draftText = 'one two three';
    const editorText = 'one three four';
    const changes = getDisplayChanges(draftText, editorText);

    const draftDeleted = getDraftHighlightRanges(changes)
      .filter((range) => range.type === 'deleted')
      .map((range) => draftText.slice(range.from, range.to));
    const editorAdded = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to));

    expect(draftDeleted.join('')).toContain('two');
    expect(draftDeleted.join('')).not.toContain('three');
    expect(editorAdded.join('')).toContain('four');
    expect(editorAdded.join('')).not.toContain('three');
  });

  it('deleted newline creates a red editor marker', () => {
    const draftText = 'one\ntwo';
    const editorText = 'onetwo';
    const changes = getDisplayChanges(draftText, editorText);
    const editorRanges = getEditorHighlightRanges(changes);
    const editorAdded = getEditorSlices(
      editorText,
      editorRanges.filter((range) => range.type === 'added'),
    );

    expect(editorRanges).toContainEqual({ type: 'deleted', from: 3, to: 3 });
    expect(editorAdded.join('')).not.toContain('one');
    expect(editorAdded.join('')).not.toContain('two');
  });

  it('deleted space creates a red editor marker', () => {
    const draftText = 'one two';
    const editorText = 'onetwo';
    const changes = getDisplayChanges(draftText, editorText);
    const draftDeleted = getDraftHighlightRanges(changes).map((range) =>
      draftText.slice(range.from, range.to),
    );
    const editorRanges = getEditorHighlightRanges(changes);
    const editorAdded = getEditorSlices(
      editorText,
      editorRanges.filter((range) => range.type === 'added'),
    );

    expect(editorRanges).toContainEqual({ type: 'deleted', from: 3, to: 3 });
    expect(editorAdded).toEqual([]);
    expect(draftDeleted.join('')).not.toContain('one');
    expect(draftDeleted.join('')).not.toContain('two');
    expect(editorRanges.some((range) => range.type === 'deleted')).toBe(true);
  });

  it('deletes repeated suffix character at the end', () => {
    const draftText = 'three';
    const changes = getDisplayChanges(draftText, 'thre');
    const draftDeleted = getDraftHighlightRanges(changes).filter(
      (range) => range.type === 'deleted',
    );
    expect(draftDeleted.map((range) => draftText.slice(range.from, range.to))).toEqual([
      'e',
    ]);
    expect(draftDeleted).toContainEqual({ type: 'deleted', from: 4, to: 5 });
    expect(getEditorHighlightRanges(changes).some((range) => range.from === range.to)).toBe(
      true,
    );
  });

  it('preserves joined unchanged draft lines after inserted editor line', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nabc\ntwo three';
    const changes = getDisplayChanges(draftText, editorText);
    const editorRanges = getEditorHighlightRanges(changes);
    const draftRanges = getDraftHighlightRanges(changes);
    const lineDecorations = getLineDecorations(draftText, editorText);

    const editorSlices = getEditorSlices(editorText, editorRanges);
    const draftSlices = getDraftSlices(draftText, draftRanges);

    expect(editorSlices).toEqual(['abc']);
    expect(draftSlices.filter((slice) => slice.length > 0)).toEqual([]);
    expect(editorSlices).not.toContain('two');
    expect(editorSlices).not.toContain('two ');
    expect(editorSlices).not.toContain('three');
    expect(draftSlices).not.toContain('two');
    expect(draftSlices).not.toContain('three');
    expect(lineDecorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(lineDecorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
  });

  it('preserves joined draft line with suffix deletion after inserted editor line', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nabc\ntwo thre';
    const changes = getDisplayChanges(draftText, editorText);
    const editorRanges = getEditorHighlightRanges(changes);
    const draftRanges = getDraftHighlightRanges(changes);
    const lineDecorations = getLineDecorations(draftText, editorText);

    const editorSlices = getEditorSlices(editorText, editorRanges);
    const draftSlices = getDraftSlices(draftText, draftRanges);

    expect(editorSlices).toEqual(['abc']);
    expect(draftSlices).toEqual(['e']);
    expect(draftRanges).toContainEqual({ type: 'deleted', from: 12, to: 13 });
    expect(editorSlices).not.toContain('two');
    expect(editorSlices).not.toContain('wo');
    expect(editorSlices).not.toContain('two ');
    expect(editorSlices).not.toContain('thre');
    expect(editorSlices).not.toContain('three');
    expect(draftSlices).not.toContain('two');
    expect(draftSlices).not.toContain('thre');
    expect(draftSlices).not.toContain('three');
    expect(lineDecorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(lineDecorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
    expect(
      lineDecorations.draftLineDecorations.some(
        (decoration) => decoration.type === 'deletedDraftLine',
      ),
    ).toBe(false);
  });

  it('inserted space creates a green draft marker', () => {
    const draftText = 'onetwo';
    const editorText = 'one two';
    const changes = getDisplayChanges(draftText, editorText);
    const draftRanges = getDraftHighlightRanges(changes);
    const draftDeletedSlices = getDraftSlices(
      draftText,
      draftRanges.filter((range) => range.type === 'deleted'),
    );
    const editorAddedSlices = getEditorSlices(
      editorText,
      getEditorHighlightRanges(changes).filter((range) => range.type === 'added'),
    );

    expect(draftRanges).toContainEqual({ type: 'added', from: 3, to: 3 });
    expect(draftDeletedSlices).toEqual([]);
    expect(editorAddedSlices.join('')).not.toContain('one');
    expect(editorAddedSlices.join('')).not.toContain('two');
  });

  it('inserted full editor line does not create draft marker tick', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nabc\ntwo three';
    const changes = getDisplayChanges(draftText, editorText);
    const draftRanges = getDraftHighlightRanges(changes);
    const lineDecorations = getLineDecorations(draftText, editorText);

    expect(
      draftRanges.some(
        (range) => range.type === 'added' && range.from === 4 && range.to === 4,
      ),
    ).toBe(false);
    expect(lineDecorations.editorLineDecorations).toEqual([{ lineNumber: 2 }]);
    expect(lineDecorations.draftLineDecorations).toEqual([
      {
        type: 'missingEditorLine',
        lineNumber: 2,
        placement: 'before',
        lineCount: 1,
      },
    ]);
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

  it('keeps joined visible text while inserting a blank editor line', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\n\ntwo three';
    const changes = getDisplayChanges(draftText, editorText);
    const decorations = getLineDecorations(draftText, editorText);
    const draftDeleted = getDraftHighlightRanges(changes).map((range) =>
      draftText.slice(range.from, range.to),
    );
    const editorAdded = getEditorHighlightRanges(changes).map((range) =>
      editorText.slice(range.from, range.to),
    );

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 2,
      placement: 'before',
      lineCount: 1,
    });
    expect(
      decorations.draftLineDecorations.some(
        (decoration) =>
          decoration.type === 'deletedDraftLine' &&
          (decoration.lineNumber === 2 || decoration.lineNumber === 3),
      ),
    ).toBe(false);
    expect(editorAdded.join('')).not.toContain('two');
    expect(editorAdded.join('')).not.toContain('three');
    expect(draftDeleted.join('')).not.toContain('two');
    expect(draftDeleted.join('')).not.toContain('three');
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

  it('pairs exact matching lines after inserted editor lines', () => {
    const draftText = [
      'intro',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
    ].join('\n');
    const editorText = [
      'intro',
      'new lines will also be tracked',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
    ].join('\n');

    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 2,
      placement: 'before',
    });
    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
  });

  it('keeps exact lines aligned across multiple inserted editor lines', () => {
    const draftText = [
      'Updates are highlighted red',
      'Your work saves as you type',
      'New lines will have the pattern below',
      '',
      'The bar on the bottom lets you change view, track word count, and more',
      '',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
      '*click the coffee mug to help support me',
    ].join('\n');
    const editorText = [
      'Updates are highlighted green',
      'Your work saves as you type',
      '',
      '',
      'New lines will look green',
      '',
      '',
      '',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
      '*click the coffee mug to help support me',
    ].join('\n');

    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 7,
      placement: 'before',
    });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 3,
      placement: 'before',
      lineCount: 2,
    });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 7,
      placement: 'before',
      lineCount: 2,
    });
  });

  it('does not use blank lines as alignment anchors', () => {
    const draftText = ['alpha', '', '', 'omega'].join('\n');
    const editorText = ['alpha', '', '', '', 'omega'].join('\n');
    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 4 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 4,
      placement: 'before',
      lineCount: 1,
    });
    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 4,
      placement: 'before',
    });
  });

  it('keeps bottom exact line paired after multiple inserted editor lines', () => {
    const draftText = [
      'Welcome to Byline',
      '',
      'A text editor for messy first drafts.',
      '',
      'This is the draft view. Write freely here.',
      '',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
    ].join('\n');
    const editorText = [
      'Welcome to Byline!',
      '',
      'A text editor for cleaner revisions.',
      '',
      'This is the editor view. Rewrite your draft here and track what changed.',
      '',
      '',
      'New lines are tracked too.',
      '',
      'Check out the bottom bar to track your word count, copy your drafts, and more',
    ].join('\n');
    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 7,
      placement: 'before',
    });
    expect(
      decorations.draftLineDecorations.some(
        (range) => range.type === 'missingEditorLine' && range.lineCount >= 1,
      ),
    ).toBe(true);
  });

  it('places inserted blank editor line before matching draft line', () => {
    const decorations = getLineDecorations('one\ntwo\nthree', 'one\ntwo\n\nthree');

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 3 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 3,
      placement: 'before',
      lineCount: 1,
    });
    expect(
      decorations.draftLineDecorations.some(
        (decoration) =>
          decoration.type === 'deletedDraftLine' && decoration.lineNumber === 3,
      ),
    ).toBe(false);
  });

  it('keeps alignment with inserted blank line and later deleted draft line', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\n\ntwo';
    const changes = getDisplayChanges(draftText, editorText);
    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'missingEditorLine',
      lineNumber: 2,
      placement: 'before',
      lineCount: 1,
    });
    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 3,
      placement: 'before',
    });

    const draftDeleted = getDraftHighlightRanges(changes)
      .filter((range) => range.type === 'deleted')
      .map((range) => draftText.slice(range.from, range.to))
      .join('');
    const editorAdded = getEditorHighlightRanges(changes)
      .filter((range) => range.type === 'added')
      .map((range) => editorText.slice(range.from, range.to))
      .join('');

    expect(draftDeleted).not.toContain('two');
    expect(editorAdded).not.toContain('two');
    expect(editorAdded).not.toContain('wo');
  });

  it('does not decorate matching single trailing blank line', () => {
    const decorations = getLineDecorations('ending\n', 'ending\n');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('does not decorate matching two trailing blank lines', () => {
    const decorations = getLineDecorations('ending\n\n', 'ending\n\n');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('does not decorate matching trailing whitespace-only blank lines', () => {
    const decorations = getLineDecorations('ending\n   ', 'ending\n\t');

    expect(decorations.editorLineDecorations).toEqual([]);
    expect(decorations.draftLineDecorations).toEqual([]);
  });

  it('keeps unmatched draft line deleted before shared trailing blank suffix', () => {
    const decorations = getLineDecorations('one\nremoved\n\n', 'one\n\n');

    expect(decorations.draftLineDecorations).toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 2,
      placement: 'before',
    });
    expect(decorations.editorLineDecorations).toEqual([]);
  });

  it('keeps unmatched editor line inserted before shared trailing blank suffix', () => {
    const decorations = getLineDecorations('one\n\n', 'one\nadded\n\n');

    expect(decorations.editorLineDecorations).toContainEqual({ lineNumber: 2 });
    expect(
      decorations.draftLineDecorations.some(
        (decoration) =>
          decoration.type === 'missingEditorLine' && decoration.lineCount >= 1,
      ),
    ).toBe(true);
    expect(
      decorations.draftLineDecorations.some(
        (decoration) =>
          decoration.type === 'deletedDraftLine' && decoration.lineNumber === 2,
      ),
    ).toBe(false);
  });

  it('pairs rewritten point-is paragraphs instead of rendering full inserted and deleted lines', () => {
    const draftText =
      'They have that same contorted painful look, but their begging is different. They’re begging you to end it.\n\n' +
      'Point is, we stopped taking those jobs. Turned a new leaf, as some might say. Yea, we’re still mercenaries, but you could consider us peace keepers. We only take on protection jobs, ones where no one gets hurt. We keep people safe, and they pay us a fuck ton for doing our job. Normally it’s the suits we handle, but today we follow Pablo into this shithole.';
    const editorText =
      "They still have that same look, still begging. Only they're begging you to end it.\n\n" +
      "Point is, we stopped taking hits. Not because we're the good guys, so don't get any ideas. We just got tired of seeing those fucked-up looks. Protection pays better anyway, and cleaner too. Stand near some rich prick, look dangerous, and get paid a fuck ton. Simple. Wives don't worry about us as much either. It's a win for everyone. On any normal day, we guarded the suits and got to see the sun. Today, they sent us down into this shithole with Pablo.";
    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.editorLineDecorations).not.toContainEqual({ lineNumber: 3 });
    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 3,
      placement: 'before',
    });
  });

  it('suppresses full inserted decoration for split-out airlock paragraph when nearby draft text matches', () => {
    const draftText =
      'I wouldn’t trust them though. There’s a reason they keep this room air tight. If there’s a fire, you open the escape hatch from the control panel and all the air shoots out. Instant fire extinguisher. The airlock slid open and led into a loading bay. This room separated the engine from the cockpit. It was a small ship, only 40 feet long, and every inch was optimized. I walked past two more airlocks on my way to navigation. I could hear the engine airlock seal behind me as the automatic cockpit door opened up.';
    const editorText =
      "I wouldn’t trust it though. Without me here, who knows how long that'll last. There’s a reason they keep engine rooms air tight. If there’s a fire, you can vent the air out into space. Instant fire extinguisher. Just make sure you're not inside unless you enjoy getting spaced.\n\n" +
      'The airlock slid open, revelaing the loading bay, a storage room that separated the engine from the cockpit. On small ships like these, every centimeter is optimized. I walked past two side airlocks on my way to navigation.';
    const decorations = getLineDecorations(draftText, editorText);

    expect(decorations.editorLineDecorations).not.toContainEqual({ lineNumber: 3 });
  });

  it('keeps rewritten and split paragraphs from being decorated as full inserted and deleted lines', () => {
    const draftText =
      'They have that same contorted painful look, but their begging is different. They’re begging you to end it.\n\n' +
      'Point is, we stopped taking those jobs. Turned a new leaf, as some might say. Yea, we’re still mercenaries, but you could consider us peace keepers. We only take on protection jobs, ones where no one gets hurt. We keep people safe, and they pay us a fuck ton for doing our job. Normally it’s the suits we handle, but today we follow Pablo into this shithole.\n\n' +
      'I wouldn’t trust them though. There’s a reason they keep this room air tight. If there’s a fire, you open the escape hatch from the control panel and all the air shoots out. Instant fire extinguisher. The airlock slid open and led into a loading bay. This room separated the engine from the cockpit. It was a small ship, only 40 feet long, and every inch was optimized. I walked past two more airlocks on my way to navigation. I could hear the engine airlock seal behind me as the automatic cockpit door opened up.';
    const editorText =
      "They still have that same look, still begging. Only they're begging you to end it.\n\n" +
      "Point is, we stopped taking hits. Not because we're the good guys, so don't get any ideas. We just got tired of seeing those fucked-up looks. Protection pays better anyway, and cleaner too. Stand near some rich prick, look dangerous, and get paid a fuck ton. Simple. Wives don't worry about us as much either. It's a win for everyone. On any normal day, we guarded the suits and got to see the sun. Today, they sent us down into this shithole with Pablo.\n\n" +
      "I wouldn’t trust it though. Without me here, who knows how long that'll last. There’s a reason they keep engine rooms air tight. If there’s a fire, you can vent the air out into space. Instant fire extinguisher. Just make sure you're not inside unless you enjoy getting spaced.\n\n" +
      'The airlock slid open, revelaing the loading bay, a storage room that separated the engine from the cockpit. On small ships like these, every centimeter is optimized. I walked past two side airlocks on my way to navigation.';
    const decorations = getLineDecorations(draftText, editorText);

    const editorDecoratedLines = decorations.editorLineDecorations.map(
      ({ lineNumber }) => lineNumber,
    );

    expect(editorDecoratedLines).not.toContain(3);
    expect(editorDecoratedLines).not.toContain(7);
    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 3,
      placement: 'before',
    });
    expect(decorations.draftLineDecorations).not.toContainEqual({
      type: 'deletedDraftLine',
      lineNumber: 5,
      placement: 'before',
    });
  });
});

describe('getDraftHighlightRanges', () => {
  it('refines typo replacement highlights to changed draft characters', () => {
    const draftText = 'misssing';
    const changes = getDisplayChanges(draftText, 'missing');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toHaveLength(1);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toBe('s');
  });

  it('uses deletion-biased refinement for duplicate-letter deletions', () => {
    const draftText = 'missing';
    const changes = getDisplayChanges(draftText, 'ming');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges).toHaveLength(1);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toHaveLength(3);
  });

  it('maps replacement draft text to a deleted highlight range', () => {
    const draftText = '300 men';
    const changes = getDisplayChanges(draftText, 'Three hundred men');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges.filter((range) => range.type === 'deleted')).toEqual([
      { type: 'deleted', from: 0, to: 3 },
    ]);
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
    const deletedDraftRanges = draftRanges.filter((range) => range.type === 'deleted');
    expect(deletedDraftRanges).toEqual([
      { type: 'deleted', from: 0, to: 3 },
    ]);
    expect(
      draftText.slice(deletedDraftRanges[0].from, deletedDraftRanges[0].to),
    ).toBe('300');
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

    expect(ranges).toHaveLength(2);
    expect(draftText.slice(ranges[0].from, ranges[0].to)).toBe('s');
    expect(draftText.slice(ranges[1].from, ranges[1].to)).toBe('word');
  });

  it('refines draft case replacement highlights', () => {
    const draftText = 'Welcome to byline';
    const changes = getDisplayChanges(draftText, 'Welcome to Byline!');
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges.map((range) => draftText.slice(range.from, range.to))).toEqual(['b']);
  });

  it('merges draft deleted ranges across a single space', () => {
    const draftText = 'a text editor for messy first drafts';
    const editorText = 'a text editor for polished drafts';
    const changes = getDisplayChanges(draftText, editorText);
    const ranges = getDraftHighlightRanges(changes);

    expect(ranges.map((range) => draftText.slice(range.from, range.to))).toContain(
      'messy first',
    );
    expect(
      ranges.some((range) => draftText.slice(range.from, range.to) === 'drafts'),
    ).toBe(false);
  });

  it('merges draft deleted ranges across punctuation and spaces', () => {
    const draftText = 'one test. test two';
    const editorText = 'one old. old two';
    const changes = getDisplayChanges(draftText, editorText);
    const deletedSlices = getDraftHighlightRanges(changes)
      .filter((range) => range.type === 'deleted')
      .map((range) => draftText.slice(range.from, range.to));

    expect(deletedSlices).toContain('test. test');
  });

  it('does not merge draft deleted ranges across newlines', () => {
    const draftText = 'a b\nc d';
    const editorText = 'a\nc';
    const changes = getDisplayChanges(draftText, editorText);
    const ranges = getDraftHighlightRanges(changes);
    const slices = ranges.map((range) => draftText.slice(range.from, range.to));

    expect(slices.some((slice) => slice.includes('\n'))).toBe(false);
  });

  it('emits draft added marker ranges for inline editor-only insertions', () => {
    const ranges = getDraftHighlightRanges(getDisplayChanges('one three', 'one two three'));
    expect(ranges.some((range) => range.type === 'added')).toBe(true);
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

describe('getLineAnchoredDraftHighlightRanges', () => {
  it('keeps lower-paragraph highlights anchored to intended lines in long text', () => {
    const draftText = [
      'That’s where we were now. The walls were covered in ropes and caribeaners, winding down the jagged rock walls.',
      '',
      'Pablo thinks they got mixed up here. Tunnels branched off from the cylindrical room above and below us. I suggested calling out, but Pablo said we shouldn’t disturb the rock in case there was a cave in. That’s why he’s our guide.',
      '',
      'A few more miles and we hit our first descent, just as expected. Pablo knew the mine inside and out. We had him draw up a map, but he was more of an abstract artist. From what I could tell, there’s an active site 17 miles down, and the workers would have to repel to get there.',
    ].join('\n');

    const editorText = [
      'That’s where we were now. The walls were covered in ropes and carabiners, winding down the jagged rock walls.',
      '',
      'Pablo thinks they got mixed up here. Tunnels branched off from the cylindrical room above and below us. I suggested calling out, but Pablo said we should not disturb the rock in case there was a cave-in. That’s why he’s our guide.',
      '',
      'A few more miles and we hit our first descent, just as expected. Pablo knew the mine inside and out. We had him draw up a map, but he was more of an abstract artist. From what I could tell, there is an active site 17 miles down, and the workers would have to rappel to get there.',
    ].join('\n');

    const ranges = getLineAnchoredDraftHighlightRanges({ draftText, editorText });
    const caribeanersStart = draftText.indexOf('caribeaners');
    const repelStart = draftText.indexOf('repel');

    expect(
      ranges.some((range) => range.from >= caribeanersStart && range.from < caribeanersStart + 'caribeaners'.length),
    ).toBe(true);
    expect(
      ranges.some((range) => range.from >= repelStart && range.from < repelStart + 'repel'.length),
    ).toBe(true);
    expect(
      ranges.every(
        (range) =>
          range.from >= 0 &&
          range.to >= range.from &&
          range.to <= draftText.length,
      ),
    ).toBe(true);
  });

  it('returns deleted range for draft-only line', () => {
    const draftText = 'keep\nremove me\nkeep';
    const editorText = 'keep\nkeep';

    const ranges = getLineAnchoredDraftHighlightRanges({ draftText, editorText });

    expect(
      ranges.some((range) => range.type === 'deleted' && draftText.slice(range.from, range.to).includes('remove me')),
    ).toBe(true);
  });

  it('returns draft added marker for editor-only inserted line', () => {
    const draftText = 'one\nthree';
    const editorText = 'one\ntwo\nthree';

    const ranges = getLineAnchoredDraftHighlightRanges({ draftText, editorText });

    expect(
      ranges.some((range) => range.type === 'added' && range.from === range.to),
    ).toBe(true);
  });
});

describe('getLineAnchoredEditorHighlightRanges', () => {
  it('keeps lower-paragraph highlights anchored to intended lines in long text', () => {
    const draftText = [
      'That’s where we were now. The walls were covered in ropes and caribeaners, winding down the jagged rock walls.',
      '',
      'Pablo thinks they got mixed up here. Tunnels branched off from the cylindrical room above and below us. I suggested calling out, but Pablo said we shouldn’t disturb the rock in case there was a cave in. That’s why he’s our guide.',
      '',
      'A few more miles and we hit our first descent, just as expected. Pablo knew the mine inside and out. We had him draw up a map, but he was more of an abstract artist. From what I could tell, there’s an active site 17 miles down, and the workers would have to repel to get there.',
    ].join('\n');

    const editorText = [
      'That’s where we were now. The walls were covered in ropes and carabiners, winding down the jagged rock walls.',
      '',
      'Pablo thinks they got mixed up here. Tunnels branched off from the cylindrical room above and below us. I suggested calling out, but Pablo said we should not disturb the rock in case there was a cave-in. That’s why he’s our guide.',
      '',
      'A few more miles and we hit our first descent, just as expected. Pablo knew the mine inside and out. We had him draw up a map, but he was more of an abstract artist. From what I could tell, there is an active site 17 miles down, and the workers would have to rappel to get there.',
    ].join('\n');

    const ranges = getLineAnchoredEditorHighlightRanges({ draftText, editorText });
    const carabinersStart = editorText.indexOf('carabiners');
    const rappelStart = editorText.indexOf('rappel');

    expect(
      ranges.some((range) => range.from >= carabinersStart && range.from < carabinersStart + 'carabiners'.length),
    ).toBe(true);
    expect(
      ranges.some((range) => range.from >= rappelStart && range.from < rappelStart + 'rappel'.length),
    ).toBe(true);
    expect(
      ranges.every(
        (range) =>
          range.from >= 0 &&
          range.to >= range.from &&
          range.to <= editorText.length,
      ),
    ).toBe(true);
  });

  it('returns full added range for editor-only inserted line', () => {
    const draftText = 'one\nthree';
    const editorText = 'one\ntwo\nthree';

    const ranges = getLineAnchoredEditorHighlightRanges({ draftText, editorText });

    expect(
      ranges.some((range) => range.type === 'added' && editorText.slice(range.from, range.to).includes('two')),
    ).toBe(true);
  });

  it('returns editor deleted marker for draft-only deleted line', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nthree';

    const ranges = getLineAnchoredEditorHighlightRanges({ draftText, editorText });

    expect(
      ranges.some((range) => range.type === 'deleted' && range.from === range.to),
    ).toBe(true);
  });
});

describe('getLineAnchoredDiffResult', () => {
  it('returns component results consistent with line-anchored helpers', () => {
    const draftText = 'alpha\nbeta\ngamma';
    const editorText = 'alpha\nbeta changed\ngamma';

    const result = getLineAnchoredDiffResult({ draftText, editorText });

    expect(result.editorHighlightRanges).toEqual(
      getLineAnchoredEditorHighlightRanges({ draftText, editorText }),
    );
    expect(result.draftHighlightRanges).toEqual(
      getLineAnchoredDraftHighlightRanges({ draftText, editorText }),
    );
    expect(result.lineDecorations).toEqual(getLineDecorations(draftText, editorText));
    expect(result.editorStats.wordCount).toBe(4);
    expect(result.editorStats.characterCount).toBe(editorText.length);
    expect(result.lowestEditedLine).toEqual({ lineNumber: 2 });
  });

  it('keeps lower repeated-paragraph highlights in intended lines', () => {
    const draftText = [
      'Foreman said they never surfaced. Guess they got lost.',
      '',
      'Foreman said they never surfaced. Guess they got lost.',
      '',
      'Foreman said they never surfaced. Guess they got lost.',
    ].join('\n');
    const editorText = [
      'Foreman said they never surfaced. Guess they got lost.',
      '',
      'Foreman said they never surfaced. Said they must have gotten lost.',
      '',
      'Foreman said they never surfaced. Guess they got lost.',
    ].join('\n');

    const result = getLineAnchoredDiffResult({ draftText, editorText });
    const editedLineStart = editorText.indexOf('Said they must have gotten lost');
    const draftEditedLineStart = draftText.indexOf('Guess they got lost.', draftText.indexOf('Guess they got lost.') + 1);

    expect(
      result.editorHighlightRanges.some(
        (range) => range.from >= editedLineStart && range.from < editedLineStart + 40,
      ),
    ).toBe(true);
    expect(
      result.draftHighlightRanges.some(
        (range) => range.from >= draftEditedLineStart && range.from < draftEditedLineStart + 20,
      ),
    ).toBe(true);
  });
});
