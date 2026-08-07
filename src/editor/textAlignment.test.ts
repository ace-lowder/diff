import { describe, expect, it } from 'vitest';

import {
  getLineAnchoredDiffResult,
  getTextAlignment,
  type TextAlignment,
  type TextAlignmentPart,
  type TextRange,
} from '../editorDiff';

type VerifiedComparison = {
  alignment: TextAlignment;
  editorHighlightText: string[];
  draftHighlightText: string[];
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
});
