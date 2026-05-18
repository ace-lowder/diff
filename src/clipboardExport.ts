import {
  containsLineBreak,
  getNormalizedFontStyleRanges,
  getResolvedHighlightRanges,
  getSegmentBoundaries,
  getTextSegment,
} from './clipboardExportHelpers';

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

export type TextSegment = {
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
      addedColor: CLIPBOARD_ADDED_COLOR,
      deletedColor: CLIPBOARD_DELETED_COLOR,
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

const isDraftClipboardHighlightCharacter = (character: string): boolean => {
  return (
    character !== ' ' &&
    character !== '\t' &&
    character !== '\n' &&
    character !== '\r'
  );
};

const escapeHtml = (text: string): string => {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
};
