export type FontStyleType = 'bold' | 'italic' | 'underline';

export type FontStyleRange = {
  type: FontStyleType;
  from: number;
  to: number;
};

export type TextChange = {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
};

export type StyledDocumentChange = {
  changes: TextChange[];
  fontStyleRanges: FontStyleRange[];
};

export type TextSelectionRange = {
  from: number;
  to: number;
};

const FONT_STYLE_TYPES: FontStyleType[] = ['bold', 'italic', 'underline'];

export const normalizeFontStyleRanges = (
  ranges: FontStyleRange[],
): FontStyleRange[] => {
  const validRanges = ranges
    .filter((range) => range.from >= 0 && range.to > range.from)
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }

      if (left.from !== right.from) {
        return left.from - right.from;
      }

      return left.to - right.to;
    });

  const mergedRanges: FontStyleRange[] = [];

  for (const range of validRanges) {
    const previousRange = mergedRanges[mergedRanges.length - 1];

    if (!previousRange || previousRange.type !== range.type) {
      mergedRanges.push({ ...range });
      continue;
    }

    if (range.from > previousRange.to) {
      mergedRanges.push({ ...range });
      continue;
    }

    previousRange.to = Math.max(previousRange.to, range.to);
  }

  return mergedRanges;
};

export const normalizeFontStyleRangesForText = ({
  ranges,
  text,
}: {
  ranges: FontStyleRange[];
  text: string;
}): FontStyleRange[] => {
  const clippedRanges: FontStyleRange[] = [];
  const textLength = text.length;

  for (const range of ranges) {
    const start = Math.max(0, Math.min(range.from, textLength));
    const end = Math.max(0, Math.min(range.to, textLength));

    if (end <= start) {
      continue;
    }

    let segmentStart = start;

    while (segmentStart < end) {
      const newlineIndex = text.indexOf('\n', segmentStart);
      const segmentEnd =
        newlineIndex === -1 || newlineIndex >= end ? end : newlineIndex;

      if (segmentEnd > segmentStart) {
        clippedRanges.push({
          ...range,
          from: segmentStart,
          to: segmentEnd,
        });
      }

      if (newlineIndex === -1 || newlineIndex >= end) {
        break;
      }

      segmentStart = newlineIndex + 1;
    }
  }

  return normalizeFontStyleRanges(clippedRanges);
};

export const areFontStyleRangesEqual = (
  leftRanges: FontStyleRange[],
  rightRanges: FontStyleRange[],
): boolean => {
  const left = normalizeFontStyleRanges(leftRanges);
  const right = normalizeFontStyleRanges(rightRanges);

  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftRange, index) => {
    const rightRange = right[index];
    return (
      rightRange !== undefined &&
      leftRange.type === rightRange.type &&
      leftRange.from === rightRange.from &&
      leftRange.to === rightRange.to
    );
  });
};

export const areTextSelectionRangesEqual = (
  leftRanges: TextSelectionRange[],
  rightRanges: TextSelectionRange[],
): boolean => {
  const left = normalizeSelections(leftRanges);
  const right = normalizeSelections(rightRanges);

  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftRange, index) => {
    const rightRange = right[index];
    return (
      rightRange !== undefined &&
      leftRange.from === rightRange.from &&
      leftRange.to === rightRange.to
    );
  });
};

export const toggleFontStyleRanges = ({
  ranges,
  type,
  selections,
  text,
}: {
  ranges: FontStyleRange[];
  type: FontStyleType;
  selections: TextSelectionRange[];
  text: string;
}): FontStyleRange[] => {
  const normalizedRanges = normalizeFontStyleRangesForText({
    ranges,
    text,
  });
  const normalizedSelections = normalizeSelections(selections);

  if (normalizedSelections.length === 0) {
    return normalizedRanges;
  }

  const styleRanges = normalizedRanges.filter((range) => range.type === type);
  const shouldRemove = normalizedSelections.every((selection) =>
    isSelectionFullyCoveredByRanges(selection, styleRanges),
  );

  const updatedStyleRanges = shouldRemove
    ? removeStyleFromSelections(styleRanges, normalizedSelections)
    : addStyleForSelections(styleRanges, normalizedSelections, type);

  const untouchedRanges = normalizedRanges.filter((range) => range.type !== type);
  return normalizeFontStyleRangesForText({
    ranges: [...untouchedRanges, ...updatedStyleRanges],
    text,
  });
};

export const mapFontStyleRangesThroughChanges = ({
  ranges,
  changes,
}: {
  ranges: FontStyleRange[];
  changes: TextChange[];
}): FontStyleRange[] => {
  const normalizedRanges = normalizeFontStyleRanges(ranges);
  let mappedRanges = normalizedRanges.map((range) => ({ ...range }));

  const orderedChanges = [...changes].sort((left, right) => left.fromA - right.fromA);

  for (const change of orderedChanges) {
    mappedRanges = mappedRanges
      .map((range) => mapSingleRangeThroughChange(range, change))
      .filter((range): range is FontStyleRange => range !== null);
  }

  return normalizeFontStyleRanges(mappedRanges);
};

export const applyFontStyleDocumentChanges = ({
  ranges,
  changes,
  activeTypes,
  insertedFontStyleRanges,
  text,
}: {
  ranges: FontStyleRange[];
  changes: TextChange[];
  activeTypes: FontStyleType[];
  insertedFontStyleRanges: FontStyleRange[];
  text: string;
}): FontStyleRange[] => {
  const mappedRanges = normalizeFontStyleRangesForText({
    ranges: mapFontStyleRangesThroughChanges({ ranges, changes }),
    text,
  });

  if (insertedFontStyleRanges.length > 0) {
    const insertedSelections = changes
      .filter((change) => change.toB > change.fromB)
      .map((change) => ({
        from: change.fromB,
        to: change.toB,
      }))
      .sort((left, right) => left.from - right.from || left.to - right.to);

    const rangesWithoutInsertedSpans = removeStyleFromSelections(
      mappedRanges,
      insertedSelections,
    );

    return normalizeFontStyleRangesForText({
      ranges: [
        ...rangesWithoutInsertedSpans,
        ...insertedFontStyleRanges,
      ],
      text,
    });
  }

  return normalizeFontStyleRangesForText({
    ranges: [
      ...mappedRanges,
      ...getInsertedFontStyleRanges({ changes, activeTypes }),
    ],
    text,
  });
};

export const getInsertedFontStyleRanges = ({
  changes,
  activeTypes,
}: {
  changes: TextChange[];
  activeTypes: FontStyleType[];
}): FontStyleRange[] => {
  const uniqueActiveTypes = Array.from(new Set(activeTypes));
  const insertedRanges: FontStyleRange[] = [];

  for (const change of changes) {
    if (change.toB <= change.fromB) {
      continue;
    }

    for (const type of uniqueActiveTypes) {
      insertedRanges.push({
        type,
        from: change.fromB,
        to: change.toB,
      });
    }
  }

  return normalizeFontStyleRanges(insertedRanges);
};

export const shouldUpdateFontStyleRangesForChanges = ({
  ranges,
  activeTypes,
}: {
  ranges: FontStyleRange[];
  activeTypes: FontStyleType[];
}): boolean => {
  return ranges.length > 0 || activeTypes.length > 0;
};

export const getActiveFontStyleTypesForSelections = ({
  ranges,
  selections,
  fallbackActiveTypes,
}: {
  ranges: FontStyleRange[];
  selections: TextSelectionRange[];
  fallbackActiveTypes: FontStyleType[];
}): FontStyleType[] => {
  const normalizedSelections = normalizeSelections(selections);

  if (normalizedSelections.length === 0) {
    const fallbackTypeSet = new Set(fallbackActiveTypes);
    return FONT_STYLE_TYPES.filter((type) => fallbackTypeSet.has(type));
  }

  const normalizedRanges = normalizeFontStyleRanges(ranges);

  return FONT_STYLE_TYPES.filter((type) => {
    const styleRanges = normalizedRanges.filter((range) => range.type === type);
    return normalizedSelections.every((selection) =>
      isSelectionFullyCoveredByRanges(selection, styleRanges),
    );
  });
};

const normalizeSelections = (
  selections: TextSelectionRange[],
): TextSelectionRange[] => {
  return selections
    .filter((selection) => selection.from >= 0 && selection.to > selection.from)
    .sort((left, right) => left.from - right.from || left.to - right.to);
};

const isSelectionFullyCoveredByRanges = (
  selection: TextSelectionRange,
  ranges: FontStyleRange[],
): boolean => {
  let coveredUntil = selection.from;

  for (const range of ranges) {
    if (range.to <= coveredUntil) {
      continue;
    }

    if (range.from > coveredUntil) {
      return false;
    }

    coveredUntil = Math.max(coveredUntil, range.to);

    if (coveredUntil >= selection.to) {
      return true;
    }
  }

  return coveredUntil >= selection.to;
};

const removeStyleFromSelections = (
  ranges: FontStyleRange[],
  selections: TextSelectionRange[],
): FontStyleRange[] => {
  let remainingRanges = ranges.map((range) => ({ ...range }));

  for (const selection of selections) {
    const nextRanges: FontStyleRange[] = [];

    for (const range of remainingRanges) {
      if (range.to <= selection.from || range.from >= selection.to) {
        nextRanges.push(range);
        continue;
      }

      if (range.from < selection.from) {
        nextRanges.push({
          type: range.type,
          from: range.from,
          to: selection.from,
        });
      }

      if (range.to > selection.to) {
        nextRanges.push({
          type: range.type,
          from: selection.to,
          to: range.to,
        });
      }
    }

    remainingRanges = nextRanges;
  }

  return remainingRanges;
};

const addStyleForSelections = (
  ranges: FontStyleRange[],
  selections: TextSelectionRange[],
  type: FontStyleType,
): FontStyleRange[] => {
  const addedRanges = selections.map((selection) => ({
    type,
    from: selection.from,
    to: selection.to,
  }));

  return normalizeFontStyleRanges([...ranges, ...addedRanges]);
};

const mapSingleRangeThroughChange = (
  range: FontStyleRange,
  change: TextChange,
): FontStyleRange | null => {
  const deletedLength = change.toA - change.fromA;
  const insertedLength = change.toB - change.fromB;
  const delta = insertedLength - deletedLength;

  if (change.toA <= range.from) {
    return {
      ...range,
      from: range.from + delta,
      to: range.to + delta,
    };
  }

  if (change.fromA >= range.to) {
    return range;
  }

  if (change.fromA <= range.from && change.toA >= range.to) {
    if (insertedLength === 0) {
      return null;
    }

    return {
      type: range.type,
      from: change.fromB,
      to: change.fromB + insertedLength,
    };
  }

  if (change.fromA < range.from) {
    const nextTo = range.to + delta;

    if (nextTo <= change.fromB) {
      return null;
    }

    return {
      type: range.type,
      from: change.fromB,
      to: nextTo,
    };
  }

  const nextTo = range.to + delta;

  if (nextTo <= range.from) {
    return null;
  }

  return {
    type: range.type,
    from: range.from,
    to: nextTo,
  };
};
