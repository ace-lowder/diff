import { getWordCount } from './textMetrics';

type CharacterIndexMatch = {
  draftIndex: number;
  editorIndex: number;
};

type CharacterRange = {
  from: number;
  to: number;
};

export type CharacterReplacementRanges = {
  draftRanges: CharacterRange[];
  editorRanges: CharacterRange[];
};

export const getCharacterReplacementRanges = (
  draftValue: string,
  editorValue: string,
): CharacterReplacementRanges | null => {
  if (!draftValue || !editorValue) {
    return null;
  }

  if (
    (/\s/.test(draftValue) || /\s/.test(editorValue)) &&
    !draftValue.includes('\n') &&
    !editorValue.includes('\n') &&
    Math.max(getWordCount(draftValue), getWordCount(editorValue)) >= 3
  ) {
    return null;
  }

  const matches = getCharacterMatches(draftValue, editorValue);
  const longestLength = Math.max(draftValue.length, editorValue.length);
  if (matches.length / longestLength < 0.5) {
    return null;
  }

  const draftRanges = getUnmatchedRanges(
    draftValue.length,
    matches.map((match) => match.draftIndex),
  );
  const editorRanges = getUnmatchedRanges(
    editorValue.length,
    matches.map((match) => match.editorIndex),
  );

  if (draftRanges.length === 0 && editorRanges.length === 0) {
    return null;
  }

  return { draftRanges, editorRanges };
};

const getCharacterMatches = (
  draftValue: string,
  editorValue: string,
): CharacterIndexMatch[] => {
  const draftCount = draftValue.length;
  const editorCount = editorValue.length;
  const scores: number[][] = Array.from({ length: draftCount + 1 }, () =>
    Array(editorCount + 1).fill(0),
  );

  for (let draftIndex = draftCount - 1; draftIndex >= 0; draftIndex -= 1) {
    for (let editorIndex = editorCount - 1; editorIndex >= 0; editorIndex -= 1) {
      const bestWithoutMatch = Math.max(
        scores[draftIndex + 1][editorIndex],
        scores[draftIndex][editorIndex + 1],
      );
      scores[draftIndex][editorIndex] =
        draftValue[draftIndex] === editorValue[editorIndex]
          ? Math.max(
              bestWithoutMatch,
              1 + scores[draftIndex + 1][editorIndex + 1],
            )
          : bestWithoutMatch;
    }
  }

  const matches: CharacterIndexMatch[] = [];
  let draftIndex = 0;
  let editorIndex = 0;

  while (draftIndex < draftCount && editorIndex < editorCount) {
    if (
      draftValue[draftIndex] === editorValue[editorIndex] &&
      scores[draftIndex][editorIndex] ===
        1 + scores[draftIndex + 1][editorIndex + 1]
    ) {
      matches.push({ draftIndex, editorIndex });
      draftIndex += 1;
      editorIndex += 1;
      continue;
    }

    if (scores[draftIndex][editorIndex + 1] >= scores[draftIndex + 1][editorIndex]) {
      editorIndex += 1;
    } else {
      draftIndex += 1;
    }
  }

  return matches;
};

const getUnmatchedRanges = (
  length: number,
  matchedIndexes: number[],
): CharacterRange[] => {
  const matchedSet = new Set(matchedIndexes);
  const ranges: CharacterRange[] = [];
  let from: number | null = null;

  for (let index = 0; index < length; index += 1) {
    if (!matchedSet.has(index)) {
      from ??= index;
      continue;
    }

    if (from !== null) {
      ranges.push({ from, to: index });
      from = null;
    }
  }

  if (from !== null) {
    ranges.push({ from, to: length });
  }

  return ranges;
};
