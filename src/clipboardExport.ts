export type ClipboardHighlightRange = {
  type: 'added' | 'deleted';
  from: number;
  to: number;
};

export type ClipboardFontStyleRange = {
  type: 'bold' | 'italic' | 'underline';
  from: number;
  to: number;
};

const CLIPBOARD_TEXT_COLOR = '#000000';
const CLIPBOARD_ADDED_COLOR = '#d9ead3';
const CLIPBOARD_DELETED_COLOR = '#f4cccc';

type TextSegment = {
  from: number;
  to: number;
  highlightColor: string | null;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
};

export const getClipboardHtml = ({
  text,
  highlightRanges,
  fontStyleRanges = [],
}: {
  text: string;
  highlightRanges: ClipboardHighlightRange[];
  fontStyleRanges?: ClipboardFontStyleRange[];
}): string => {
  const resolvedHighlightRanges = getResolvedHighlightRanges(text, highlightRanges);
  const normalizedFontStyleRanges = getNormalizedFontStyleRanges(text, fontStyleRanges);
  const boundaries = getSegmentBoundaries(
    text,
    resolvedHighlightRanges,
    normalizedFontStyleRanges,
  );

  let html = `<div style="white-space: pre-wrap; color: ${CLIPBOARD_TEXT_COLOR}; font-family: Arial, sans-serif;">`;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const from = boundaries[index];
    const to = boundaries[index + 1];

    if (to <= from) {
      continue;
    }

    const segmentText = text.slice(from, to);

    if (segmentText.length === 0) {
      continue;
    }

    if (containsLineBreak(segmentText)) {
      html += escapeHtml(segmentText);
      continue;
    }

    const segment = getTextSegment({
      from,
      to,
      highlightRanges: resolvedHighlightRanges,
      fontStyleRanges: normalizedFontStyleRanges,
    });

    if (!segment) {
      html += escapeHtml(segmentText);
      continue;
    }

    const style = getSegmentStyle(segment);

    if (!style) {
      html += escapeHtml(segmentText);
      continue;
    }

    html += `<span style="${style}">${escapeHtml(segmentText)}</span>`;
  }

  html += '</div>';
  return html;
};

export const getDraftClipboardHighlightRanges = ({
  text,
  highlightRanges,
}: {
  text: string;
  highlightRanges: ClipboardHighlightRange[];
}): ClipboardHighlightRange[] => {
  const sortedRanges = [...highlightRanges]
    .filter((range) => range.type === 'deleted')
    .sort((left, right) => left.from - right.from || left.to - right.to);
  const draftRanges: ClipboardHighlightRange[] = [];

  for (const range of sortedRanges) {
    const clampedFrom = Math.max(0, range.from);
    const clampedTo = Math.min(text.length, range.to);

    if (clampedTo <= clampedFrom) {
      continue;
    }

    let runStart: number | null = null;

    for (let index = clampedFrom; index < clampedTo; index += 1) {
      if (isDraftClipboardHighlightCharacter(text[index])) {
        if (runStart === null) {
          runStart = index;
        }
        continue;
      }

      if (runStart !== null) {
        draftRanges.push({
          type: 'deleted',
          from: runStart,
          to: index,
        });
        runStart = null;
      }
    }

    if (runStart !== null) {
      draftRanges.push({
        type: 'deleted',
        from: runStart,
        to: clampedTo,
      });
    }
  }

  return draftRanges;
};

const getResolvedHighlightRanges = (
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

const getResolvedHighlightRange = (
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

const getResolvedZeroWidthDeletedRange = (
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

const getNormalizedFontStyleRanges = (
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

const getSegmentBoundaries = (
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

const getTextSegment = ({
  from,
  to,
  highlightRanges,
  fontStyleRanges,
}: {
  from: number;
  to: number;
  highlightRanges: ClipboardHighlightRange[];
  fontStyleRanges: ClipboardFontStyleRange[];
}): TextSegment | null => {
  let highlightColor: string | null = null;

  for (const range of highlightRanges) {
    if (range.from <= from && to <= range.to) {
      highlightColor =
        range.type === 'added' ? CLIPBOARD_ADDED_COLOR : CLIPBOARD_DELETED_COLOR;
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

const getSegmentStyle = (segment: TextSegment): string => {
  const styles: string[] = [];

  if (segment.highlightColor) {
    styles.push(`background-color: ${segment.highlightColor}`);
    styles.push(`color: ${CLIPBOARD_TEXT_COLOR}`);
  }

  if (segment.isBold) {
    styles.push('font-weight: 700');
  }

  if (segment.isItalic) {
    styles.push('font-style: italic');
  }

  if (segment.isUnderline) {
    styles.push('text-decoration: underline');
  }

  return styles.join('; ');
};

const containsLineBreak = (text: string): boolean => {
  return text.includes('\n') || text.includes('\r');
};

const isDraftClipboardHighlightCharacter = (character: string): boolean => {
  return (
    character !== ' ' &&
    character !== '\t' &&
    character !== '\n' &&
    character !== '\r'
  );
};

const isLineBreak = (character: string): boolean => {
  return character === '\n' || character === '\r';
};

const escapeHtml = (text: string): string => {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
};
