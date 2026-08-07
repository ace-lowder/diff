import { expect } from 'vitest';

import {
  getLineAnchoredDiffResult,
  getTextAlignment,
  type DraftHighlightRange,
  type DraftLineDecoration,
  type EditorHighlightRange,
  type EditorStats,
  type TextAlignment,
  type TextAlignmentPart,
  type TextRange,
} from '../editorDiff';

export type VerifiedComparison = {
  alignment: TextAlignment;
  editorHighlightText: string[];
  draftHighlightText: string[];
  editorDecoratedLines: number[];
  draftLineDecorations: DraftLineDecoration[];
  editorHighlightRanges: EditorHighlightRange[];
  draftHighlightRanges: DraftHighlightRange[];
  editorStats: EditorStats;
};

export const expectLinkedAt = (
  alignment: TextAlignment,
  draftFrom: number,
  editorFrom: number,
  description = `draft ${draftFrom} to editor ${editorFrom}`,
) => {
  const hasLinkedPosition = alignment.parts.some(
    (part) =>
      part.type === 'linked' &&
      part.draftRange.from <= draftFrom &&
      part.draftRange.to > draftFrom &&
      part.editorRange.from <= editorFrom &&
      part.editorRange.to > editorFrom &&
      draftFrom - part.draftRange.from === editorFrom - part.editorRange.from,
  );
  const nearbyParts = alignment.parts.filter(
    (part) =>
      part.draftRange &&
      part.draftRange.to >= draftFrom - 1 &&
      part.draftRange.from <= draftFrom + 1,
  );

  expect(
    hasLinkedPosition,
    `Expected linked text at ${description}; nearby ${JSON.stringify(nearbyParts)}`,
  ).toBe(true);
};

export const getVerifiedComparison = (
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

export const getLinkedText = (
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

export const getUnmatchedLines = (
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

export const getLinkedLines = (
  alignment: TextAlignment,
  draftText: string,
  editorText: string,
) => {
  return getLinkedText(alignment, draftText, editorText).map((link) => ({
    draftText: link.draftText.replace(/\n$/, ''),
    editorText: link.editorText.replace(/\n$/, ''),
  }));
};

export const getVisibleHighlightText = (highlightText: string[]) => {
  return highlightText.filter((text) => text.length > 0);
};
