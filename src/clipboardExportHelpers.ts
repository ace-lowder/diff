import type {
  ClipboardFontStyleRange,
  ClipboardHighlightRange,
  TextSegment,
} from './clipboardExport';

export const getResolvedHighlightRanges = (
  text: string,
  highlightRanges: ClipboardHighlightRange[],
): ClipboardHighlightRange[] => {
  const sortedRanges = [...highlightRanges].sort(
    (left, right) => left.from - right.from || left.to - right.to,
  );

  const resolvedRanges: ClipboardHighlightRange[] = [];
  let cursor = 0;

  for (const range of sortedRanges) {
    if (range.from < 0 || range.to < range.from) {
      continue;
    }

    const resolvedRange = getResolvedHighlightRange(text, range);

    if (!resolvedRange) {
      continue;
    }

    if (resolvedRange.from < cursor) {
      continue;
    }

    resolvedRanges.push(resolvedRange);
    cursor = resolvedRange.to;
  }

  return resolvedRanges;
};

export const getNormalizedFontStyleRanges = (
  text: string,
  fontStyleRanges: ClipboardFontStyleRange[],
): ClipboardFontStyleRange[] => {
  return [...fontStyleRanges]
    .filter(
      (range) =>
        range.from >= 0 &&
        range.to > range.from &&
        range.to <= text.length &&
        (range.type === 'bold' || range.type === 'italic' || range.type === 'underline'),
    )
    .sort((left, right) => {
      if (left.from !== right.from) {
        return left.from - right.from;
      }

      if (left.to !== right.to) {
        return left.to - right.to;
      }

      return left.type.localeCompare(right.type);
    });
};

export const getSegmentBoundaries = (
  text: string,
  highlightRanges: ClipboardHighlightRange[],
  fontStyleRanges: ClipboardFontStyleRange[],
): number[] => {
  const boundaries = new Set<number>([0, text.length]);

  for (const range of highlightRanges) {
    boundaries.add(range.from);
    boundaries.add(range.to);
  }

  for (const range of fontStyleRanges) {
    boundaries.add(range.from);
    boundaries.add(range.to);
  }

  for (let index = 0; index < text.length; index += 1) {
    if (isLineBreak(text[index])) {
      boundaries.add(index);
      boundaries.add(index + 1);
    }
  }

  return [...boundaries].sort((left, right) => left - right);
};

export const getTextSegment = ({
  from,
  to,
  highlightRanges,
  fontStyleRanges,
  addedColor,
  deletedColor,
}: {
  from: number;
  to: number;
  highlightRanges: ClipboardHighlightRange[];
  fontStyleRanges: ClipboardFontStyleRange[];
  addedColor: string;
  deletedColor: string;
}): TextSegment | null => {
  let highlightColor: string | null = null;

  for (const range of highlightRanges) {
    if (range.from <= from && to <= range.to) {
      highlightColor = range.type === 'added' ? addedColor : deletedColor;
      break;
    }
  }

  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  for (const range of fontStyleRanges) {
    if (!(range.from <= from && to <= range.to)) {
      continue;
    }

    if (range.type === 'bold') {
      isBold = true;
      continue;
    }

    if (range.type === 'italic') {
      isItalic = true;
      continue;
    }

    isUnderline = true;
  }

  if (!highlightColor && !isBold && !isItalic && !isUnderline) {
    return null;
  }

  return {
    from,
    to,
    highlightColor,
    isBold,
    isItalic,
    isUnderline,
  };
};

export const getResolvedHighlightRange = (
  text: string,
  range: ClipboardHighlightRange,
): ClipboardHighlightRange | null => {
  if (range.from > text.length || range.to > text.length) {
    return null;
  }

  if (range.type === 'added') {
    if (range.from >= range.to) {
      return null;
    }

    return range;
  }

  if (range.from < range.to) {
    return range;
  }

  return getResolvedZeroWidthDeletedRange(text, range.from);
};

export const getResolvedZeroWidthDeletedRange = (
  text: string,
  from: number,
): ClipboardHighlightRange | null => {
  if (text.length === 0) {
    return null;
  }

  const rightCharacter = text[from];
  if (rightCharacter && !isLineBreak(rightCharacter)) {
    return { type: 'deleted', from, to: from + 1 };
  }

  const previousIndex = from - 1;
  if (previousIndex < 0) {
    return null;
  }

  const previousCharacter = text[previousIndex];
  if (!previousCharacter || isLineBreak(previousCharacter)) {
    return null;
  }

  return { type: 'deleted', from: previousIndex, to: previousIndex + 1 };
};

export const containsLineBreak = (text: string): boolean => {
  return text.includes('\n') || text.includes('\r');
};

export const isLineBreak = (character: string): boolean => {
  return character === '\n' || character === '\r';
};
