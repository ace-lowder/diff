import { describe, expect, it } from 'vitest';

import {
  getLineAnchoredDiffResult,
  getTextAlignment,
  type DraftLineDecoration,
  type EditorHighlightRange,
  type EditorStats,
  type DraftHighlightRange,
  type TextAlignment,
  type TextAlignmentPart,
  type TextRange,
} from '../editorDiff';

type VerifiedComparison = {
  alignment: TextAlignment;
  editorHighlightText: string[];
  draftHighlightText: string[];
  editorDecoratedLines: number[];
  draftLineDecorations: DraftLineDecoration[];
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  editorStats: EditorStats;
};

type ExactChangeCase = {
  name: string;
  draftLines: string[];
  editorLines: string[];
  linkedLines: string[];
  draftOnlyLines: string[];
  editorOnlyLines: string[];
};

const EXACT_CHANGE_CASES: ExactChangeCase[] = [
  {
    name: 'one insertion at the start',
    draftLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    editorLines: [
      'New opening paragraph.',
      'Alpha paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
    ],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: [],
    editorOnlyLines: ['New opening paragraph.'],
  },
  {
    name: 'consecutive insertions in the middle',
    draftLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    editorLines: [
      'Alpha paragraph.',
      'First new paragraph.',
      'Second new paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
    ],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: [],
    editorOnlyLines: ['First new paragraph.', 'Second new paragraph.'],
  },
  {
    name: 'one insertion at the end',
    draftLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    editorLines: [
      'Alpha paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
      'New closing paragraph.',
    ],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: [],
    editorOnlyLines: ['New closing paragraph.'],
  },
  {
    name: 'one deletion at the start',
    draftLines: [
      'Removed opening paragraph.',
      'Alpha paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
    ],
    editorLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: ['Removed opening paragraph.'],
    editorOnlyLines: [],
  },
  {
    name: 'consecutive deletions in the middle',
    draftLines: [
      'Alpha paragraph.',
      'First removed paragraph.',
      'Second removed paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
    ],
    editorLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: ['First removed paragraph.', 'Second removed paragraph.'],
    editorOnlyLines: [],
  },
  {
    name: 'one deletion at the end',
    draftLines: [
      'Alpha paragraph.',
      'Bravo paragraph.',
      'Charlie paragraph.',
      'Removed closing paragraph.',
    ],
    editorLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    linkedLines: ['Alpha paragraph.', 'Bravo paragraph.', 'Charlie paragraph.'],
    draftOnlyLines: ['Removed closing paragraph.'],
    editorOnlyLines: [],
  },
];

const INLINE_FORMATTING_CASES = [
  {
    name: 'punctuation',
    draftLine: 'Wait, what happened?',
    editorLine: 'Wait—what happened!',
    draftHighlightText: [',', '?'],
    editorHighlightText: ['—', '!'],
  },
  {
    name: 'math symbols',
    draftLine: 'The rule is x < y.',
    editorLine: 'The rule is x ≤ y.',
    draftHighlightText: ['<'],
    editorHighlightText: ['≤'],
  },
  {
    name: 'emoji',
    draftLine: 'Status: ready.',
    editorLine: 'Status: ready ✅.',
    draftHighlightText: [],
    editorHighlightText: [' ✅'],
  },
  {
    name: 'accented words',
    draftLine: 'Café déjà vu.',
    editorLine: 'Café déjà vu — résumé.',
    draftHighlightText: [],
    editorHighlightText: [' — résumé'],
  },
  {
    name: 'non-Latin writing',
    draftLine: '今日は晴れです。',
    editorLine: '今日は晴れですよ。',
    draftHighlightText: [],
    editorHighlightText: ['よ'],
  },
] as const;

const getVerifiedComparison = (
  draftText: string,
  editorText: string,
): VerifiedComparison => {
  const alignment = getTextAlignment(draftText, editorText);
  const diff = getLineAnchoredDiffResult({ draftText, editorText });

  expectAlignmentToCoverText(alignment, draftText, editorText);
  expectValidRanges(diff.draftHighlightRanges, draftText);
  expectValidRanges(diff.editorHighlightRanges, editorText);

  return {
    alignment,
    draftHighlightText: diff.draftHighlightRanges.map((range) =>
      draftText.slice(range.from, range.to),
    ),
    editorHighlightText: diff.editorHighlightRanges.map((range) =>
      editorText.slice(range.from, range.to),
    ),
    editorDecoratedLines: diff.lineDecorations.editorLineDecorations.map(
      ({ lineNumber }) => lineNumber,
    ),
    draftLineDecorations: diff.lineDecorations.draftLineDecorations,
    editorHighlightRanges: diff.editorHighlightRanges,
    draftHighlightRanges: diff.draftHighlightRanges,
    editorStats: diff.editorStats,
  };
};

const expectAlignmentToCoverText = (
  alignment: TextAlignment,
  draftText: string,
  editorText: string,
) => {
  expectAlignmentSideToCoverText(alignment.parts, 'draftRange', draftText);
  expectAlignmentSideToCoverText(alignment.parts, 'editorRange', editorText);

  for (const part of alignment.parts) {
    if (part.type === 'linked') {
      expect(part.draftRange).not.toBeNull();
      expect(part.editorRange).not.toBeNull();
    } else if (part.type === 'draftOnly') {
      expect(part.draftRange).not.toBeNull();
      expect(part.editorRange).toBeNull();
    } else {
      expect(part.draftRange).toBeNull();
      expect(part.editorRange).not.toBeNull();
    }
  }
};

const expectAlignmentSideToCoverText = (
  parts: TextAlignmentPart[],
  side: 'draftRange' | 'editorRange',
  text: string,
) => {
  const ranges = parts.flatMap((part) => (part[side] ? [part[side]] : []));
  let position = 0;

  for (const range of ranges) {
    expect(range.from).toBe(position);
    expect(range.to).toBeGreaterThanOrEqual(range.from);
    expect(range.to).toBeLessThanOrEqual(text.length);
    position = range.to;
  }

  expect(position).toBe(text.length);
  expect(ranges.map((range) => text.slice(range.from, range.to)).join('')).toBe(text);
};

const expectValidRanges = (ranges: TextRange[], text: string) => {
  let previousRange: TextRange | null = null;

  for (const range of ranges) {
    expect(range.from).toBeGreaterThanOrEqual(0);
    expect(range.to).toBeGreaterThanOrEqual(range.from);
    expect(range.to).toBeLessThanOrEqual(text.length);

    if (previousRange) {
      expect(range.from).toBeGreaterThanOrEqual(previousRange.to);
    }

    previousRange = range;
  }
};

const getLinkedText = (
  alignment: TextAlignment,
  draftText: string,
  editorText: string,
) => {
  return alignment.parts.flatMap((part) => {
    if (part.type !== 'linked') {
      return [];
    }

    return [
      {
        draftText: draftText.slice(part.draftRange.from, part.draftRange.to),
        editorText: editorText.slice(part.editorRange.from, part.editorRange.to),
      },
    ];
  });
};

const getUnmatchedLines = (
  alignment: TextAlignment,
  type: 'draftOnly' | 'editorOnly',
  draftText: string,
  editorText: string,
) => {
  return alignment.parts.flatMap((part) => {
    if (part.type !== type) {
      return [];
    }

    const range = type === 'editorOnly' ? part.editorRange : part.draftRange;
    const text = type === 'editorOnly' ? editorText : draftText;
    return range ? [text.slice(range.from, range.to).replace(/\n$/, '')] : [];
  });
};

const getLinkedLines = (
  alignment: TextAlignment,
  draftText: string,
  editorText: string,
) => {
  return getLinkedText(alignment, draftText, editorText).map((link) => ({
    draftText: link.draftText.replace(/\n$/, ''),
    editorText: link.editorText.replace(/\n$/, ''),
  }));
};

const getVisibleHighlightText = (highlightText: string[]) => {
  return highlightText.filter((text) => text.length > 0);
};

describe('getTextAlignment', () => {
  it('exposes exact draft-to-editor links', () => {
    const draftText = 'Opening paragraph.\nClosing paragraph.';
    const comparison = getVerifiedComparison(draftText, draftText);

    expect(getLinkedText(comparison.alignment, draftText, draftText)).toEqual([
      {
        draftText: 'Opening paragraph.\n',
        editorText: 'Opening paragraph.\n',
      },
      {
        draftText: 'Closing paragraph.',
        editorText: 'Closing paragraph.',
      },
    ]);
    expect(comparison.draftHighlightText).toEqual([]);
    expect(comparison.editorHighlightText).toEqual([]);
  });

  it.each(EXACT_CHANGE_CASES)('keeps exact links for $name', (testCase) => {
    const draftText = testCase.draftLines.join('\n');
    const editorText = testCase.editorLines.join('\n');
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedLines(comparison.alignment, draftText, editorText)).toEqual(
      testCase.linkedLines.map((line) => ({ draftText: line, editorText: line })),
    );
    expect(
      getUnmatchedLines(comparison.alignment, 'draftOnly', draftText, editorText),
    ).toEqual(testCase.draftOnlyLines);
    expect(
      getUnmatchedLines(comparison.alignment, 'editorOnly', draftText, editorText),
    ).toEqual(testCase.editorOnlyLines);
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual(
      testCase.draftOnlyLines,
    );
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual(
      testCase.editorOnlyLines,
    );
  });

  it('keeps surrounding text linked when a blank line is inserted', () => {
    const draftText = 'Opening paragraph.\nClosing paragraph.';
    const editorText = 'Opening paragraph.\n\nClosing paragraph.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
      'linked',
      'editorOnly',
      'linked',
    ]);
    expect(getLinkedLines(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Opening paragraph.', editorText: 'Opening paragraph.' },
      { draftText: 'Closing paragraph.', editorText: 'Closing paragraph.' },
    ]);
    expect(comparison.draftHighlightRanges).toContainEqual({
      type: 'added',
      from: 19,
      to: 19,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });

  it('keeps surrounding text linked when a blank line is deleted', () => {
    const draftText = 'Opening paragraph.\n\nClosing paragraph.';
    const editorText = 'Opening paragraph.\nClosing paragraph.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
      'linked',
      'draftOnly',
      'linked',
    ]);
    expect(getLinkedLines(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Opening paragraph.', editorText: 'Opening paragraph.' },
      { draftText: 'Closing paragraph.', editorText: 'Closing paragraph.' },
    ]);
    expect(comparison.editorHighlightRanges).toContainEqual({
      type: 'deleted',
      from: 19,
      to: 19,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });

  it.each(INLINE_FORMATTING_CASES)(
    'keeps the line linked and highlights only changed $name',
    (testCase) => {
      const draftText = `Opening paragraph.\n${testCase.draftLine}\nClosing paragraph.`;
      const editorText = `Opening paragraph.\n${testCase.editorLine}\nClosing paragraph.`;
      const comparison = getVerifiedComparison(draftText, editorText);

      expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
        'linked',
        'linked',
        'linked',
      ]);
      expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual(
        testCase.draftHighlightText,
      );
      expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual(
        testCase.editorHighlightText,
      );
      expect(comparison.editorDecoratedLines).toEqual([]);
      expect(comparison.draftLineDecorations).toEqual([]);
    },
  );

  it('keeps both sides of a split line linked', () => {
    const draftText = 'Alpha beta gamma delta.';
    const editorText = 'Alpha beta\ngamma delta.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Alpha beta', editorText: 'Alpha beta' },
      { draftText: 'gamma delta.', editorText: 'gamma delta.' },
    ]);
    expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
      'linked',
      'draftOnly',
      'editorOnly',
      'linked',
    ]);
    expect(comparison.draftHighlightRanges).toContainEqual({
      type: 'added',
      from: 10,
      to: 10,
    });
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual([]);
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual([]);
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 0,
      deletedWordCount: 0,
      addedCharacterCount: 1,
      deletedCharacterCount: 1,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });

  it('keeps text linked across several inserted line breaks', () => {
    const draftText = 'Alpha beta gamma delta epsilon zeta.';
    const editorText = 'Alpha beta\ngamma delta\nepsilon zeta.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Alpha beta', editorText: 'Alpha beta' },
      { draftText: 'gamma delta', editorText: 'gamma delta' },
      { draftText: 'epsilon zeta.', editorText: 'epsilon zeta.' },
    ]);
    expect(
      comparison.draftHighlightRanges.filter((range) => range.type === 'added'),
    ).toEqual([
      { type: 'added', from: 10, to: 10 },
      { type: 'added', from: 22, to: 22 },
    ]);
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 0,
      deletedWordCount: 0,
      addedCharacterCount: 2,
      deletedCharacterCount: 2,
    });
  });

  it('keeps both sides linked when lines are merged', () => {
    const draftText = 'Alpha beta\ngamma delta.';
    const editorText = 'Alpha beta gamma delta.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Alpha beta', editorText: 'Alpha beta' },
      { draftText: 'gamma delta.', editorText: 'gamma delta.' },
    ]);
    expect(comparison.editorHighlightRanges).toContainEqual({
      type: 'deleted',
      from: 10,
      to: 10,
    });
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual([]);
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual([]);
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 0,
      deletedWordCount: 0,
      addedCharacterCount: 1,
      deletedCharacterCount: 1,
    });
  });

  it('preserves links around a split and nearby rewrite', () => {
    const draftText = 'Alpha beta gamma delta.';
    const editorText = 'Alpha beta\ngamma revised.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Alpha beta', editorText: 'Alpha beta' },
      { draftText: 'gamma ', editorText: 'gamma ' },
      { draftText: '.', editorText: '.' },
    ]);
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual(['delta']);
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual([
      'revised',
    ]);
    expect(comparison.draftHighlightRanges).toContainEqual({
      type: 'added',
      from: 10,
      to: 10,
    });
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 1,
      deletedWordCount: 1,
      addedCharacterCount: 8,
      deletedCharacterCount: 6,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });

  it('preserves links around a split and nearby insertion', () => {
    const draftText = 'Alpha beta gamma delta.';
    const editorText = 'Alpha beta\ngamma bright delta.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'Alpha beta', editorText: 'Alpha beta' },
      { draftText: 'gamma', editorText: 'gamma' },
      { draftText: ' delta.', editorText: ' delta.' },
    ]);
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual([]);
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual([
      ' bright',
    ]);
    expect(
      comparison.draftHighlightRanges.filter((range) => range.type === 'added'),
    ).toEqual([
      { type: 'added', from: 10, to: 10 },
      { type: 'added', from: 16, to: 16 },
    ]);
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 1,
      deletedWordCount: 0,
      addedCharacterCount: 8,
      deletedCharacterCount: 1,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });

  it('preserves links when one line is added and two later lines are merged', () => {
    const draftText = 'one\ntwo\nthree';
    const editorText = 'one\nnew\ntwo three';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(getLinkedText(comparison.alignment, draftText, editorText)).toEqual([
      { draftText: 'one\n', editorText: 'one\n' },
      { draftText: 'two', editorText: 'two' },
      { draftText: 'three', editorText: 'three' },
    ]);
    expect(getVisibleHighlightText(comparison.draftHighlightText)).toEqual([]);
    expect(getVisibleHighlightText(comparison.editorHighlightText)).toEqual(['new']);
    expect(comparison.editorHighlightRanges).toContainEqual({
      type: 'deleted',
      from: 11,
      to: 11,
    });
    expect(comparison.editorStats).toMatchObject({
      addedWordCount: 1,
      deletedWordCount: 0,
      addedCharacterCount: 5,
      deletedCharacterCount: 1,
    });
    expect(comparison.editorDecoratedLines).toEqual([]);
    expect(comparison.draftLineDecorations).toEqual([]);
  });
});
