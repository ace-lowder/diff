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
  insertedFontStyleRanges: FontStyleRange[];
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
}: {
  ranges: FontStyleRange[];
  type: FontStyleType;
  selections: TextSelectionRange[];
}): FontStyleRange[] => {
  const normalizedRanges = normalizeFontStyleRanges(ranges);
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
  return normalizeFontStyleRanges([...untouchedRanges, ...updatedStyleRanges]);
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
}: {
  ranges: FontStyleRange[];
  changes: TextChange[];
  activeTypes: FontStyleType[];
  insertedFontStyleRanges: FontStyleRange[];
}): FontStyleRange[] => {
  if (
    ranges.length === 0 &&
    activeTypes.length === 0 &&
    insertedFontStyleRanges.length === 0
  ) {
    return ranges;
  }

  const mappedRanges = mapFontStyleRangesThroughChanges({ ranges, changes });

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

    const nextRanges = normalizeFontStyleRanges([
      ...rangesWithoutInsertedSpans,
      ...insertedFontStyleRanges,
    ]);

    return areFontStyleRangesEqual(ranges, nextRanges) ? ranges : nextRanges;
  }

  const nextRanges = normalizeFontStyleRanges([
    ...mappedRanges,
    ...getInsertedFontStyleRanges({ changes, activeTypes }),
  ]);

  return areFontStyleRangesEqual(ranges, nextRanges) ? ranges : nextRanges;
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

  const overlapStart = Math.max(range.from, change.fromA);
  const overlapEnd = Math.min(range.to, change.toA);
  const removedInside = Math.max(0, overlapEnd - overlapStart);

  let nextFrom = range.from;
  let nextTo = range.to - removedInside;

  if (change.fromA < range.from) {
    nextFrom = change.fromB;
  }

  if (change.toA <= range.to) {
    nextTo += insertedLength;
  }

  if (nextTo <= nextFrom) {
    return null;
  }

  return {
    type: range.type,
    from: nextFrom,
    to: nextTo,
  };
};
