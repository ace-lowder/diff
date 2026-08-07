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

  it('keeps later text linked across an inserted line', () => {
    const draftText = 'Opening paragraph.\nClosing paragraph.';
    const editorText = 'Opening paragraph.\nNew paragraph.\nClosing paragraph.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
      'linked',
      'editorOnly',
      'linked',
    ]);
    expect(getLinkedText(comparison.alignment, draftText, editorText)).toContainEqual({
      draftText: 'Closing paragraph.',
      editorText: 'Closing paragraph.',
    });
    expect(comparison.editorHighlightText).toContain('New paragraph.');
  });

  it('keeps later text linked across a deleted line', () => {
    const draftText = 'Opening paragraph.\nRemoved paragraph.\nClosing paragraph.';
    const editorText = 'Opening paragraph.\nClosing paragraph.';
    const comparison = getVerifiedComparison(draftText, editorText);

    expect(comparison.alignment.parts.map((part) => part.type)).toEqual([
      'linked',
      'draftOnly',
      'linked',
    ]);
    expect(getLinkedText(comparison.alignment, draftText, editorText)).toContainEqual({
      draftText: 'Closing paragraph.',
      editorText: 'Closing paragraph.',
    });
    expect(comparison.draftHighlightText).toContain('Removed paragraph.');
  });
});
