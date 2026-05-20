import { diffWordsWithSpace } from 'diff';

export type StatsMode = 'words' | 'characters';

export type DisplayChangeType = 'equal' | 'inserted' | 'deleted' | 'replaced';

export type DisplayChange = {
  type: DisplayChangeType;
  draftValue: string;
  editorValue: string;
};

export type EditorStats = {
  wordCount: number;
  characterCount: number;
  addedWordCount: number;
  deletedWordCount: number;
  addedCharacterCount: number;
  deletedCharacterCount: number;
};

export type EditorHighlightRangeType = 'added' | 'deleted';

export type EditorHighlightRange = {
  type: EditorHighlightRangeType;
  from: number;
  to: number;
};

export type DraftHighlightRangeType = 'deleted' | 'added';

export type DraftHighlightRange = {
  type: DraftHighlightRangeType;
  from: number;
  to: number;
};

type ReplacementHighlightOffsets = {
  draftFromOffset: number;
  draftToOffset: number;
  editorFromOffset: number;
  editorToOffset: number;
};

export type EditorLineDecoration = {
  lineNumber: number;
};

export type DraftLineDecorationPlacement = 'before' | 'after';

export type DraftLineDecorationType = 'missingEditorLine' | 'deletedDraftLine';

export type DraftLineDecoration =
  | {
      type: 'missingEditorLine';
      lineNumber: number;
      placement: DraftLineDecorationPlacement;
      lineCount: number;
    }
  | {
      type: 'deletedDraftLine';
      lineNumber: number;
      placement: 'before';
    };

export type LowestEditedLine = {
  lineNumber: number;
};

type RawChangeType = 'equal' | 'inserted' | 'deleted';

type RawChange = {
  type: RawChangeType;
  value: string;
};

type LinePair = {
  draftLine: string | null;
  editorLine: string | null;
  draftLineNumber: number;
  editorLineNumber: number;
  placement: DraftLineDecorationPlacement;
};

type LineAlignmentMatch = {
  draftIndex: number;
  editorIndex: number;
};

type ReplacementToken = {
  value: string;
  from: number;
  to: number;
  isWhitespace: boolean;
};

type ReplacementRange = {
  from: number;
  to: number;
};

type ReplacementRangePair = {
  draftRanges: ReplacementRange[];
  editorRanges: ReplacementRange[];
};

const FULL_WORD_MEANINGFUL_CHANGE_THRESHOLD = 2;

export const getWordCount = (text: string): number => {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return 0;
  }

  return trimmedText.split(/\s+/).length;
};

export const getDisplayChanges = (
  draftText: string,
  editorText: string,
): DisplayChange[] => {
  const rawChanges = mergeRawChanges(
    diffWordsWithSpace(draftText, editorText).map((part) => {
      if (part.added) {
        return { type: 'inserted', value: part.value } as RawChange;
      }

      if (part.removed) {
        return { type: 'deleted', value: part.value } as RawChange;
      }

      return { type: 'equal', value: part.value } as RawChange;
    }),
  );

  const displayChanges: DisplayChange[] = [];

  for (let index = 0; index < rawChanges.length; index += 1) {
    const currentChange = rawChanges[index];
    const nextChange = rawChanges[index + 1];

    if (
      nextChange &&
      ((currentChange.type === 'deleted' && nextChange.type === 'inserted') ||
        (currentChange.type === 'inserted' && nextChange.type === 'deleted')) &&
      shouldPairAsReplacement(currentChange.value, nextChange.value)
    ) {
      if (currentChange.type === 'deleted') {
        displayChanges.push({
          type: 'replaced',
          draftValue: currentChange.value,
          editorValue: nextChange.value,
        });
      } else {
        displayChanges.push({
          type: 'replaced',
          draftValue: nextChange.value,
          editorValue: currentChange.value,
        });
      }

      index += 1;
      continue;
    }

    if (
      nextChange &&
      currentChange.type === 'deleted' &&
      nextChange.type === 'inserted' &&
      currentChange.value.includes('\n') &&
      currentChange.value.replace(/\n/g, '') === nextChange.value
    ) {
      const draftParts = currentChange.value.split('\n');
      for (let partIndex = 0; partIndex < draftParts.length; partIndex += 1) {
        const part = draftParts[partIndex];
        if (part) {
          displayChanges.push({
            type: 'equal',
            draftValue: part,
            editorValue: part,
          });
        }
        if (partIndex < draftParts.length - 1) {
          displayChanges.push({
            type: 'deleted',
            draftValue: '\n',
            editorValue: '',
          });
        }
      }
      index += 1;
      continue;
    }

    if (currentChange.type === 'equal') {
      displayChanges.push({
        type: 'equal',
        draftValue: currentChange.value,
        editorValue: currentChange.value,
      });
      continue;
    }

    if (currentChange.type === 'inserted') {
      displayChanges.push({
        type: 'inserted',
        draftValue: '',
        editorValue: currentChange.value,
      });
      continue;
    }

    displayChanges.push({
      type: 'deleted',
      draftValue: currentChange.value,
      editorValue: '',
    });
  }

  const combinedChanges = combineReplacementInsertions(
    combineWhitespaceBridgedChanges(mergeDisplayChanges(displayChanges)),
  );

  return normalizeInsertedLineBeforeJoinedDraftLines(
    normalizeRepeatedLineReplacements(
      collapseNoisySingleLineReplacements(
        normalizeInsertedWhitespace(normalizeReplacementWhitespace(combinedChanges)),
      ),
    ),
  );
};

export const getEditorStats = (
  editorText: string,
  displayChanges: DisplayChange[],
): EditorStats => {
  const addedTextParts: string[] = [];
  const deletedTextParts: string[] = [];

  for (const displayChange of displayChanges) {
    if (displayChange.type === 'inserted' || displayChange.type === 'replaced') {
      addedTextParts.push(displayChange.editorValue);
    }

    if (displayChange.type === 'deleted' || displayChange.type === 'replaced') {
      deletedTextParts.push(displayChange.draftValue);
    }
  }

  const addedText = addedTextParts.join('');
  const deletedText = deletedTextParts.join('');

  return {
    wordCount: getWordCount(editorText),
    characterCount: editorText.length,
    addedWordCount: getWordCount(addedTextParts.join(' ')),
    deletedWordCount: getWordCount(deletedTextParts.join(' ')),
    addedCharacterCount: addedText.length,
    deletedCharacterCount: deletedText.length,
  };
};

export const getEditorHighlightRanges = (
  displayChanges: DisplayChange[],
): EditorHighlightRange[] => {
  const editorText = getEditorText(displayChanges);
  const ranges: EditorHighlightRange[] = [];
  let editorPosition = 0;

  for (const displayChange of displayChanges) {
    if (displayChange.type === 'equal') {
      editorPosition += displayChange.editorValue.length;
      continue;
    }

    if (displayChange.type === 'inserted') {
      ranges.push(
        ...getVisibleEditorRangeSegments({
          text: displayChange.editorValue,
          basePosition: editorPosition,
        }),
      );
      editorPosition += displayChange.editorValue.length;
      continue;
    }

    if (displayChange.type === 'replaced') {
      const replacementRanges = getReplacementEditorRanges({
        displayChange,
        editorPosition,
      });

      if (replacementRanges.length > 0) {
        ranges.push(...replacementRanges);
      }

      editorPosition += displayChange.editorValue.length;
      continue;
    }

    if (shouldRenderEditorDeletedMarker(displayChange.draftValue)) {
      ranges.push({ type: 'deleted', from: editorPosition, to: editorPosition });
    }

    continue;
  }

  return mergeAddedRangesAcrossInlineGaps(
    getVisibleEditorRanges(ranges, editorText),
    editorText,
  );
};

export const getLineDecorations = (
  draftText: string,
  editorText: string,
): {
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
} => {
  const linePairs = getLinePairs(draftText, editorText);
  const draftLines = draftText.split('\n');
  const editorLineDecorations: EditorLineDecoration[] = [];
  const draftLineDecorations: DraftLineDecoration[] = [];
  const missingEditorLineIndexes = new Map<string, number>();
  const deletedDraftLineKeys = new Set<string>();

  for (let linePairIndex = 0; linePairIndex < linePairs.length; linePairIndex += 1) {
    const linePair = linePairs[linePairIndex];
    if (linePair.draftLine === null && linePair.editorLine !== null) {
      editorLineDecorations.push({ lineNumber: linePair.editorLineNumber });
      const draftLineNumber = getMissingEditorLineAnchor({
        linePairs,
        linePairIndex,
        draftLines,
      });
      const missingEditorLineKey = `${draftLineNumber}:${linePair.placement}`;
      const existingDecorationIndex =
        missingEditorLineIndexes.get(missingEditorLineKey);

      if (existingDecorationIndex === undefined) {
        missingEditorLineIndexes.set(
          missingEditorLineKey,
          draftLineDecorations.length,
        );
        draftLineDecorations.push({
          type: 'missingEditorLine',
          lineNumber: draftLineNumber,
          placement: linePair.placement,
          lineCount: 1,
        });
      } else {
        const existingDecoration = draftLineDecorations[existingDecorationIndex];
        if (existingDecoration.type === 'missingEditorLine') {
          existingDecoration.lineCount += 1;
        }
      }
      continue;
    }

    if (linePair.draftLine !== null && linePair.editorLine === null) {
      if (isDraftLineTextPreservedNearPair(linePairs, linePairIndex)) {
        continue;
      }
      const decoration: DraftLineDecoration = {
        type: 'deletedDraftLine',
        lineNumber: linePair.draftLineNumber,
        placement: 'before',
      };
      const decorationKey = getDraftLineDecorationKey(decoration);
      if (!deletedDraftLineKeys.has(decorationKey)) {
        deletedDraftLineKeys.add(decorationKey);
        draftLineDecorations.push(decoration);
      }
    }
  }

  return { editorLineDecorations, draftLineDecorations };
};

const getMissingEditorLineAnchor = ({
  linePairs,
  linePairIndex,
  draftLines,
}: {
  linePairs: LinePair[];
  linePairIndex: number;
  draftLines: string[];
}): number => {
  const linePair = linePairs[linePairIndex];
  if (!linePair || linePair.draftLine !== null || linePair.editorLine === null) {
    return 1;
  }

  let draftLineNumber = Math.max(1, linePair.draftLineNumber);
  const nextEditorLine = linePairs
    .slice(linePairIndex + 1)
    .find((pair) => pair.editorLine !== null)?.editorLine;
  if (linePair.placement === 'before' && nextEditorLine) {
    const normalizedNextEditorLine = getNormalizedVisibleLineText(nextEditorLine);
    const previousDraftLineNumber = getPreviousDraftLineNumber(linePairs, linePairIndex);
    const scanStart = Math.max(1, previousDraftLineNumber + 1);
    const scanEnd = Math.min(draftLines.length, draftLineNumber);

    for (let candidateLineNumber = scanStart; candidateLineNumber <= scanEnd; candidateLineNumber += 1) {
      const candidateDraftLine = draftLines[candidateLineNumber - 1] ?? '';
      const normalizedCandidate = getNormalizedVisibleLineText(candidateDraftLine);
      if (!normalizedCandidate) {
        continue;
      }
      if (normalizedNextEditorLine.includes(normalizedCandidate)) {
        draftLineNumber = candidateLineNumber;
        break;
      }
    }
  }

  if (
    linePair.placement === 'before' &&
    linePair.editorLine.trim() === '' &&
    draftLineNumber > 1
  ) {
    const previousDraftLine = draftLines[draftLineNumber - 2] ?? '';
    const normalizedPreviousDraftLine = getNormalizedVisibleLineText(previousDraftLine);
    if (!normalizedPreviousDraftLine) {
      return draftLineNumber;
    }
    const nextMatchedPair = linePairs
      .slice(linePairIndex + 1)
      .find((pair) => pair.draftLine !== null && pair.editorLine !== null);
    if (
      nextMatchedPair?.editorLine &&
      getNormalizedVisibleLineText(nextMatchedPair.editorLine).includes(
        normalizedPreviousDraftLine,
      )
    ) {
      draftLineNumber -= 1;
    }
  }

  return draftLineNumber;
};

export const getDraftHighlightRanges = (
  displayChanges: DisplayChange[],
): DraftHighlightRange[] => {
  const ranges: DraftHighlightRange[] = [];
  let draftPosition = 0;

  for (const displayChange of displayChanges) {
    if (displayChange.type === 'equal') {
      draftPosition += displayChange.draftValue.length;
      continue;
    }

    if (displayChange.type === 'inserted') {
      if (shouldRenderDraftAddedMarker(displayChange.editorValue)) {
        ranges.push({ type: 'added', from: draftPosition, to: draftPosition });
      }
      continue;
    }

    const fullRangeFrom = draftPosition;
    const fullRangeTo = fullRangeFrom + displayChange.draftValue.length;
    let from = fullRangeFrom;
    let to = fullRangeTo;

    if (displayChange.type === 'replaced') {
      if (isWhitespaceOnlyReplacement(displayChange.draftValue, displayChange.editorValue)) {
        draftPosition = fullRangeTo;
        continue;
      }
      const characterRanges = getCharacterReplacementDraftRanges({
        draftValue: displayChange.draftValue,
        editorValue: displayChange.editorValue,
        draftPosition,
      });
      if (characterRanges) {
        ranges.push(...characterRanges);
        draftPosition = fullRangeTo;
        continue;
      }
    }

    if (
      displayChange.type === 'replaced' &&
      hasReplacementTokenSeparators(displayChange.draftValue, displayChange.editorValue)
    ) {
      const tokenRanges = getTokenReplacementDraftRanges({
        draftValue: displayChange.draftValue,
        editorValue: displayChange.editorValue,
        draftPosition,
      });
      if (tokenRanges.length > 0) {
        ranges.push(...tokenRanges);
      }
    } else if (
      displayChange.type === 'replaced' &&
      shouldRefineCasePunctuationReplacement(
        displayChange.draftValue,
        displayChange.editorValue,
      )
    ) {
      const casePunctuationRanges = getCasePunctuationReplacementDraftRanges({
        draftValue: displayChange.draftValue,
        editorValue: displayChange.editorValue,
        draftPosition,
      });

      if (casePunctuationRanges.length > 0) {
        ranges.push(...casePunctuationRanges);
      }
    } else if (
      displayChange.type === 'replaced' &&
      shouldRefineSameLengthReplacement(
        displayChange.draftValue,
        displayChange.editorValue,
      )
    ) {
      const sameLengthRanges = getSameLengthReplacementDraftRanges({
        draftValue: displayChange.draftValue,
        editorValue: displayChange.editorValue,
        draftPosition,
      });

      if (sameLengthRanges.length > 0) {
        ranges.push(...sameLengthRanges);
      }
    } else if (
      displayChange.type === 'replaced' &&
      shouldRefineReplacementHighlight(
        displayChange.draftValue,
        displayChange.editorValue,
      )
    ) {
      const offsets = getReplacementHighlightOffsets(
        displayChange.draftValue,
        displayChange.editorValue,
      );
      from = draftPosition + offsets.draftFromOffset;
      to = draftPosition + offsets.draftToOffset;

      if (to > from) {
        ranges.push({ type: 'deleted', from, to });
      } else if (shouldRenderDraftAddedMarker(displayChange.editorValue)) {
        ranges.push({ type: 'added', from: draftPosition, to: draftPosition });
      }
    } else if (to > from) {
      ranges.push({ type: 'deleted', from, to });
    }

    draftPosition = fullRangeTo;
  }

  const draftText = getDraftText(displayChanges);
  return filterVisibleDraftDeletedRanges(
    mergeDeletedRangesAcrossInlineGaps(ranges, draftText),
    draftText,
  );
};

export const getLowestEditedLine = (
  displayChanges: DisplayChange[],
): LowestEditedLine | null => {
  let editorLineNumber = 1;
  let lowestEditedLineNumber: number | null = null;

  for (const displayChange of displayChanges) {
    const editorNewlineCount = getNewlineCount(displayChange.editorValue);

    if (displayChange.type !== 'equal') {
      lowestEditedLineNumber = getLastEditedEditorLine(
        editorLineNumber,
        displayChange.editorValue,
      );
    }

    editorLineNumber += editorNewlineCount;
  }

  if (lowestEditedLineNumber === null) {
    return null;
  }

  return { lineNumber: lowestEditedLineNumber };
};

const getReplacementEditorRanges = ({
  displayChange,
  editorPosition,
}: {
  displayChange: DisplayChange;
  editorPosition: number;
}): EditorHighlightRange[] => {
  if (isWhitespaceOnlyReplacement(displayChange.draftValue, displayChange.editorValue)) {
    return [];
  }

  const characterRanges = getCharacterReplacementEditorRanges({
    draftValue: displayChange.draftValue,
    editorValue: displayChange.editorValue,
    editorPosition,
  });
  if (characterRanges) {
    return characterRanges;
  }

  if (shouldUseTokenReplacementRefinement(displayChange.draftValue, displayChange.editorValue)) {
    return getTokenReplacementEditorRanges({
      draftValue: displayChange.draftValue,
      editorValue: displayChange.editorValue,
      editorPosition,
    });
  }

  if (
    shouldRefineCasePunctuationReplacement(
      displayChange.draftValue,
      displayChange.editorValue,
    )
  ) {
    return getCasePunctuationReplacementEditorRanges({
      draftValue: displayChange.draftValue,
      editorValue: displayChange.editorValue,
      editorPosition,
    });
  }

  if (
    shouldRefineSameLengthReplacement(
      displayChange.draftValue,
      displayChange.editorValue,
    )
  ) {
    return getSameLengthReplacementEditorRanges({
      draftValue: displayChange.draftValue,
      editorValue: displayChange.editorValue,
      editorPosition,
    });
  }

  const shouldRefine = shouldRefineReplacementHighlight(
    displayChange.draftValue,
    displayChange.editorValue,
  );
  const offsets = getReplacementHighlightOffsets(
    displayChange.draftValue,
    displayChange.editorValue,
  );

  if (shouldRefine) {
    const from = editorPosition + offsets.editorFromOffset;
    const to = editorPosition + offsets.editorToOffset;

    if (to > from) {
      return [{ type: 'added', from, to }];
    }

    if (shouldRenderEditorDeletedMarker(displayChange.draftValue)) {
      return [{ type: 'deleted', from: editorPosition, to: editorPosition }];
    }

    return [];
  }

  if (
    hasEmptyEditorReplacementSpan(offsets) &&
    offsets.draftToOffset > offsets.draftFromOffset
  ) {
    if (shouldRenderEditorDeletedMarker(displayChange.draftValue)) {
      return [{ type: 'deleted', from: editorPosition, to: editorPosition }];
    }
    return [];
  }

  const from = editorPosition;
  const to = from + displayChange.editorValue.length;
  if (to <= from) {
    return [];
  }

  return [{ type: 'added', from, to }];
};

const getLastEditedEditorLine = (
  editorLineNumber: number,
  editorValue: string,
): number => {
  const editorNewlineCount = getNewlineCount(editorValue);
  if (editorNewlineCount === 0) {
    return editorLineNumber;
  }

  if (editorValue.endsWith('\n')) {
    return editorLineNumber + editorNewlineCount - 1;
  }

  return editorLineNumber + editorNewlineCount;
};

const getNewlineCount = (text: string): number => {
  return text.split('\n').length - 1;
};

const shouldRefineReplacementHighlight = (
  draftValue: string,
  editorValue: string,
): boolean => {
  if (shouldRefineCasePunctuationReplacement(draftValue, editorValue)) {
    return true;
  }

  if (!draftValue || !editorValue) {
    return false;
  }

  if (/\s/.test(draftValue) || /\s/.test(editorValue)) {
    return false;
  }

  const shortestLength = Math.min(draftValue.length, editorValue.length);
  if (shortestLength < 3) {
    return false;
  }

  const offsets = getReplacementHighlightOffsets(draftValue, editorValue);
  const sharedPrefixLength = offsets.draftFromOffset;
  const sharedSuffixLength = draftValue.length - offsets.draftToOffset;

  return sharedPrefixLength > 0 || sharedSuffixLength > 0;
};

const shouldRefineCasePunctuationReplacement = (
  draftValue: string,
  editorValue: string,
): boolean => {
  if (!draftValue || !editorValue) {
    return false;
  }

  if (/\s/.test(draftValue) || /\s/.test(editorValue)) {
    return false;
  }

  const draftCore = getLowercaseAlphanumericText(draftValue);
  const editorCore = getLowercaseAlphanumericText(editorValue);

  if (!draftCore || !editorCore) {
    return false;
  }

  if (draftCore !== editorCore) {
    return false;
  }

  return draftValue !== editorValue;
};

const shouldRefineSameLengthReplacement = (
  draftValue: string,
  editorValue: string,
): boolean => {
  if (!draftValue || !editorValue) {
    return false;
  }

  if (/\s/.test(draftValue) || /\s/.test(editorValue)) {
    return false;
  }

  if (draftValue.length !== editorValue.length || draftValue.length < 3) {
    return false;
  }

  let changedCount = 0;
  for (let index = 0; index < draftValue.length; index += 1) {
    if (draftValue[index] !== editorValue[index]) {
      changedCount += 1;
    }
  }

  return (
    changedCount > 0 &&
    changedCount <= 2 &&
    changedCount / draftValue.length <= 0.4
  );
};

const shouldUseTokenReplacementRefinement = (
  draftValue: string,
  editorValue: string,
): boolean => {
  if (!hasReplacementTokenSeparators(draftValue, editorValue)) {
    return false;
  }

  const pairs = getTokenReplacementPairs({ draftValue, editorValue });

  return pairs.some(({ draftToken, editorToken }) => {
    if (!draftToken || !editorToken) {
      return false;
    }

    if (draftToken.value === editorToken.value) {
      return false;
    }

    return (
      shouldRefineCasePunctuationReplacement(draftToken.value, editorToken.value) ||
      shouldRefineSameLengthReplacement(draftToken.value, editorToken.value) ||
      shouldRefineReplacementHighlight(draftToken.value, editorToken.value)
    );
  });
};

const hasReplacementTokenSeparators = (
  draftValue: string,
  editorValue: string,
): boolean => {
  return /\s/.test(draftValue) || /\s/.test(editorValue);
};

const getLowercaseAlphanumericText = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const getAlphanumericWordSpan = (value: string): ReplacementRange | null => {
  const wordMatches = [...value.matchAll(/[a-z0-9]+/gi)];
  if (wordMatches.length !== 1) {
    return null;
  }

  const [wordMatch] = wordMatches;
  const from = wordMatch.index ?? -1;
  if (from < 0) {
    return null;
  }
  const to = from + wordMatch[0].length;

  return { from, to };
};

const getLowercaseAlphanumericCore = (value: string): string => {
  return getLowercaseAlphanumericText(value);
};

const removeIgnoredTrailingPluralS = (value: string): string => {
  if (value.length <= 1 || !value.endsWith('s')) {
    return value;
  }

  return value.slice(0, -1);
};

const getMeaningfulWordCore = (value: string): string => {
  return removeIgnoredTrailingPluralS(getLowercaseAlphanumericCore(value));
};

const getEditDistance = (left: string, right: string): number => {
  const leftLength = left.length;
  const rightLength = right.length;
  const table: number[][] = Array.from({ length: leftLength + 1 }, () =>
    Array(rightLength + 1).fill(0),
  );

  for (let leftIndex = 0; leftIndex <= leftLength; leftIndex += 1) {
    table[leftIndex][0] = leftIndex;
  }
  for (let rightIndex = 0; rightIndex <= rightLength; rightIndex += 1) {
    table[0][rightIndex] = rightIndex;
  }

  for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      table[leftIndex][rightIndex] = Math.min(
        table[leftIndex - 1][rightIndex] + 1,
        table[leftIndex][rightIndex - 1] + 1,
        table[leftIndex - 1][rightIndex - 1] + substitutionCost,
      );
    }
  }

  return table[leftLength][rightLength];
};

const isPureWordEdgeChange = ({
  draftValue,
  editorValue,
}: {
  draftValue: string;
  editorValue: string;
}): boolean => {
  const draftCore = getLowercaseAlphanumericCore(draftValue);
  const editorCore = getLowercaseAlphanumericCore(editorValue);

  if (!draftCore || !editorCore) {
    return false;
  }

  if (draftCore === editorCore) {
    return true;
  }

  return (
    draftCore.startsWith(editorCore) ||
    draftCore.endsWith(editorCore) ||
    editorCore.startsWith(draftCore) ||
    editorCore.endsWith(draftCore)
  );
};

const getWholeWordReplacementRanges = ({
  draftValue,
  editorValue,
}: {
  draftValue: string;
  editorValue: string;
}): ReplacementRangePair | null => {
  const draftSpan = getAlphanumericWordSpan(draftValue);
  const editorSpan = getAlphanumericWordSpan(editorValue);

  if (!draftSpan || !editorSpan) {
    return null;
  }

  if (isPureWordEdgeChange({ draftValue, editorValue })) {
    return null;
  }

  const meaningfulDraftCore = getMeaningfulWordCore(draftValue);
  const meaningfulEditorCore = getMeaningfulWordCore(editorValue);

  if (!meaningfulDraftCore || !meaningfulEditorCore) {
    return null;
  }

  const offsets = getReplacementHighlightOffsets(draftValue, editorValue);
  const draftChangedLength = offsets.draftToOffset - offsets.draftFromOffset;
  const editorChangedLength = offsets.editorToOffset - offsets.editorFromOffset;
  if (draftChangedLength <= 0 || editorChangedLength <= 0) {
    return null;
  }

  const meaningfulDistance = getEditDistance(
    meaningfulDraftCore,
    meaningfulEditorCore,
  );

  if (meaningfulDistance < FULL_WORD_MEANINGFUL_CHANGE_THRESHOLD) {
    return null;
  }

  return {
    draftRanges: [draftSpan],
    editorRanges: [editorSpan],
  };
};

const getCasePunctuationReplacementEditorRanges = ({
  draftValue,
  editorValue,
  editorPosition,
}: {
  draftValue: string;
  editorValue: string;
  editorPosition: number;
}): EditorHighlightRange[] => {
  const draftAlphanumericPositions = getAlphanumericPositions(draftValue);
  const editorAlphanumericPositions = getAlphanumericPositions(editorValue);

  if (draftAlphanumericPositions.length !== editorAlphanumericPositions.length) {
    return [];
  }

  const changedEditorPositions = new Set<number>();

  for (let index = 0; index < editorValue.length; index += 1) {
    if (!isAlphanumericCharacter(editorValue[index])) {
      changedEditorPositions.add(index);
    }
  }

  for (let index = 0; index < draftAlphanumericPositions.length; index += 1) {
    const draftIndex = draftAlphanumericPositions[index];
    const editorIndex = editorAlphanumericPositions[index];

    if (draftValue[draftIndex] !== editorValue[editorIndex]) {
      changedEditorPositions.add(editorIndex);
    }
  }

  return getMergedCharacterRanges(changedEditorPositions).map((range) => ({
    type: 'added',
    from: editorPosition + range.from,
    to: editorPosition + range.to,
  }));
};

const getCasePunctuationReplacementDraftRanges = ({
  draftValue,
  editorValue,
  draftPosition,
}: {
  draftValue: string;
  editorValue: string;
  draftPosition: number;
}): DraftHighlightRange[] => {
  const draftAlphanumericPositions = getAlphanumericPositions(draftValue);
  const editorAlphanumericPositions = getAlphanumericPositions(editorValue);

  if (draftAlphanumericPositions.length !== editorAlphanumericPositions.length) {
    return [];
  }

  const changedDraftPositions = new Set<number>();

  for (let index = 0; index < draftAlphanumericPositions.length; index += 1) {
    const draftIndex = draftAlphanumericPositions[index];
    const editorIndex = editorAlphanumericPositions[index];

    if (draftValue[draftIndex] !== editorValue[editorIndex]) {
      changedDraftPositions.add(draftIndex);
    }
  }

  return getMergedCharacterRanges(changedDraftPositions).map((range) => ({
    type: 'deleted',
    from: draftPosition + range.from,
    to: draftPosition + range.to,
  }));
};

const getSameLengthReplacementEditorRanges = ({
  draftValue,
  editorValue,
  editorPosition,
}: {
  draftValue: string;
  editorValue: string;
  editorPosition: number;
}): EditorHighlightRange[] => {
  const changedEditorPositions = new Set<number>();

  for (let index = 0; index < editorValue.length; index += 1) {
    if (draftValue[index] !== editorValue[index]) {
      changedEditorPositions.add(index);
    }
  }

  return getMergedCharacterRanges(changedEditorPositions).map((range) => ({
    type: 'added',
    from: editorPosition + range.from,
    to: editorPosition + range.to,
  }));
};

const getSameLengthReplacementDraftRanges = ({
  draftValue,
  editorValue,
  draftPosition,
}: {
  draftValue: string;
  editorValue: string;
  draftPosition: number;
}): DraftHighlightRange[] => {
  const changedDraftPositions = new Set<number>();

  for (let index = 0; index < draftValue.length; index += 1) {
    if (draftValue[index] !== editorValue[index]) {
      changedDraftPositions.add(index);
    }
  }

  return getMergedCharacterRanges(changedDraftPositions).map((range) => ({
    type: 'deleted',
    from: draftPosition + range.from,
    to: draftPosition + range.to,
  }));
};

const getTokenReplacementEditorRanges = ({
  draftValue,
  editorValue,
  editorPosition,
}: {
  draftValue: string;
  editorValue: string;
  editorPosition: number;
}): EditorHighlightRange[] => {
  const pairs = getTokenReplacementPairs({ draftValue, editorValue });
  const ranges: EditorHighlightRange[] = [];

  for (const pair of pairs) {
    const draftToken = pair.draftToken;
    const editorToken = pair.editorToken;

    if (draftToken && editorToken) {
      if (draftToken.value === editorToken.value) {
        continue;
      }

      const wholeWordRanges = getWholeWordReplacementRanges({
        draftValue: draftToken.value,
        editorValue: editorToken.value,
      });
      if (wholeWordRanges) {
        ranges.push(
          ...wholeWordRanges.editorRanges.map((range) => ({
            type: 'added' as const,
            from: editorPosition + editorToken.from + range.from,
            to: editorPosition + editorToken.from + range.to,
          })),
        );
        continue;
      }

      if (shouldRefineCasePunctuationReplacement(draftToken.value, editorToken.value)) {
        ranges.push(
          ...getCasePunctuationReplacementEditorRanges({
            draftValue: draftToken.value,
            editorValue: editorToken.value,
            editorPosition: editorPosition + editorToken.from,
          }),
        );
        continue;
      }

      if (shouldRefineSameLengthReplacement(draftToken.value, editorToken.value)) {
        ranges.push(
          ...getSameLengthReplacementEditorRanges({
            draftValue: draftToken.value,
            editorValue: editorToken.value,
            editorPosition: editorPosition + editorToken.from,
          }),
        );
        continue;
      }

      if (shouldRefineReplacementHighlight(draftToken.value, editorToken.value)) {
        const offsets = getReplacementHighlightOffsets(draftToken.value, editorToken.value);
        const from = editorPosition + editorToken.from + offsets.editorFromOffset;
        const to = editorPosition + editorToken.from + offsets.editorToOffset;

        if (to > from) {
          ranges.push({ type: 'added', from, to });
        } else if (shouldRenderEditorDeletedMarker(draftToken.value)) {
          ranges.push({
            type: 'deleted',
            from: editorPosition + editorToken.from,
            to: editorPosition + editorToken.from,
          });
        }
        continue;
      }

      const offsets = getReplacementHighlightOffsets(draftToken.value, editorToken.value);
      if (
        hasEmptyEditorReplacementSpan(offsets) &&
        offsets.draftToOffset > offsets.draftFromOffset
      ) {
        if (shouldRenderEditorDeletedMarker(draftToken.value)) {
          ranges.push({
            type: 'deleted',
            from: editorPosition + editorToken.from,
            to: editorPosition + editorToken.from,
          });
        }
        continue;
      }

      ranges.push({
        type: 'added',
        from: editorPosition + editorToken.from,
        to: editorPosition + editorToken.to,
      });
      continue;
    }

    if (editorToken && !draftToken) {
      ranges.push({
        type: 'added',
        from: editorPosition + editorToken.from,
        to: editorPosition + editorToken.to,
      });
      continue;
    }

    if (draftToken && !editorToken) {
      if (shouldRenderEditorDeletedMarker(draftToken.value)) {
        ranges.push({
          type: 'deleted',
          from: editorPosition,
          to: editorPosition,
        });
      }
      continue;
    }
  }

  return ranges;
};

const getTokenReplacementDraftRanges = ({
  draftValue,
  editorValue,
  draftPosition,
}: {
  draftValue: string;
  editorValue: string;
  draftPosition: number;
}): DraftHighlightRange[] => {
  const pairs = getTokenReplacementPairs({ draftValue, editorValue });
  const ranges: DraftHighlightRange[] = [];

  for (const pair of pairs) {
    const draftToken = pair.draftToken;
    const editorToken = pair.editorToken;

    if (draftToken && editorToken) {
      if (draftToken.value === editorToken.value) {
        continue;
      }

      const wholeWordRanges = getWholeWordReplacementRanges({
        draftValue: draftToken.value,
        editorValue: editorToken.value,
      });
      if (wholeWordRanges) {
        ranges.push(
          ...wholeWordRanges.draftRanges.map((range) => ({
            type: 'deleted' as const,
            from: draftPosition + draftToken.from + range.from,
            to: draftPosition + draftToken.from + range.to,
          })),
        );
        continue;
      }

      if (shouldRefineCasePunctuationReplacement(draftToken.value, editorToken.value)) {
        ranges.push(
          ...getCasePunctuationReplacementDraftRanges({
            draftValue: draftToken.value,
            editorValue: editorToken.value,
            draftPosition: draftPosition + draftToken.from,
          }),
        );
        continue;
      }

      if (shouldRefineSameLengthReplacement(draftToken.value, editorToken.value)) {
        ranges.push(
          ...getSameLengthReplacementDraftRanges({
            draftValue: draftToken.value,
            editorValue: editorToken.value,
            draftPosition: draftPosition + draftToken.from,
          }),
        );
        continue;
      }

      if (shouldRefineReplacementHighlight(draftToken.value, editorToken.value)) {
        const offsets = getReplacementHighlightOffsets(draftToken.value, editorToken.value);
        const from = draftPosition + draftToken.from + offsets.draftFromOffset;
        const to = draftPosition + draftToken.from + offsets.draftToOffset;

        if (to > from) {
          ranges.push({ type: 'deleted', from, to });
        } else if (shouldRenderDraftAddedMarker(editorToken.value)) {
          ranges.push({
            type: 'added',
            from: draftPosition + draftToken.from,
            to: draftPosition + draftToken.from,
          });
        }
        continue;
      }

      const offsets = getReplacementHighlightOffsets(draftToken.value, editorToken.value);
      if (
        hasEmptyDraftReplacementSpan(offsets) &&
        offsets.editorToOffset > offsets.editorFromOffset
      ) {
        if (shouldRenderDraftAddedMarker(editorToken.value)) {
          ranges.push({
            type: 'added',
            from: draftPosition + draftToken.from,
            to: draftPosition + draftToken.from,
          });
        }
        continue;
      }

      ranges.push({
        type: 'deleted',
        from: draftPosition + draftToken.from,
        to: draftPosition + draftToken.to,
      });
      continue;
    }

    if (draftToken && !editorToken) {
      ranges.push({
        type: 'deleted',
        from: draftPosition + draftToken.from,
        to: draftPosition + draftToken.to,
      });
      continue;
    }

    if (editorToken && !draftToken) {
      if (shouldRenderDraftAddedMarker(editorToken.value)) {
        ranges.push({
          type: 'added',
          from: draftPosition,
          to: draftPosition,
        });
      }
      continue;
    }
  }

  return ranges;
};

const getTokenReplacementPairs = ({
  draftValue,
  editorValue,
}: {
  draftValue: string;
  editorValue: string;
}): Array<{
  draftToken: ReplacementToken | null;
  editorToken: ReplacementToken | null;
}> => {
  const draftTokens = getReplacementTokens(draftValue).filter(
    (token) => !token.isWhitespace,
  );
  const editorTokens = getReplacementTokens(editorValue).filter(
    (token) => !token.isWhitespace,
  );

  const pairs: Array<{
    draftToken: ReplacementToken | null;
    editorToken: ReplacementToken | null;
  }> = [];

  if (draftTokens.length === editorTokens.length) {
    for (let index = 0; index < draftTokens.length; index += 1) {
      pairs.push({
        draftToken: draftTokens[index],
        editorToken: editorTokens[index],
      });
    }
    return pairs;
  }

  let draftIndex = 0;
  let editorIndex = 0;

  while (draftIndex < draftTokens.length && editorIndex < editorTokens.length) {
    const draftToken = draftTokens[draftIndex];
    const editorToken = editorTokens[editorIndex];

    if (draftToken.value === editorToken.value) {
      pairs.push({ draftToken, editorToken });
      draftIndex += 1;
      editorIndex += 1;
      continue;
    }

    const draftMatchInEditor = findTokenIndex({
      tokens: editorTokens,
      value: draftToken.value,
      startIndex: editorIndex + 1,
    });
    const editorMatchInDraft = findTokenIndex({
      tokens: draftTokens,
      value: editorToken.value,
      startIndex: draftIndex + 1,
    });

    if (draftMatchInEditor !== null && editorMatchInDraft === null) {
      while (editorIndex < draftMatchInEditor) {
        pairs.push({ draftToken: null, editorToken: editorTokens[editorIndex] });
        editorIndex += 1;
      }
      continue;
    }

    if (draftMatchInEditor === null && editorMatchInDraft !== null) {
      while (draftIndex < editorMatchInDraft) {
        pairs.push({ draftToken: draftTokens[draftIndex], editorToken: null });
        draftIndex += 1;
      }
      continue;
    }

    if (draftMatchInEditor !== null && editorMatchInDraft !== null) {
      const draftDistance = draftMatchInEditor - editorIndex;
      const editorDistance = editorMatchInDraft - draftIndex;

      if (draftDistance <= editorDistance) {
        while (editorIndex < draftMatchInEditor) {
          pairs.push({ draftToken: null, editorToken: editorTokens[editorIndex] });
          editorIndex += 1;
        }
      } else {
        while (draftIndex < editorMatchInDraft) {
          pairs.push({ draftToken: draftTokens[draftIndex], editorToken: null });
          draftIndex += 1;
        }
      }
      continue;
    }

    pairs.push({ draftToken, editorToken });
    draftIndex += 1;
    editorIndex += 1;
  }

  while (draftIndex < draftTokens.length) {
    pairs.push({ draftToken: draftTokens[draftIndex], editorToken: null });
    draftIndex += 1;
  }

  while (editorIndex < editorTokens.length) {
    pairs.push({ draftToken: null, editorToken: editorTokens[editorIndex] });
    editorIndex += 1;
  }

  return pairs;
};

const findTokenIndex = ({
  tokens,
  value,
  startIndex,
}: {
  tokens: ReplacementToken[];
  value: string;
  startIndex: number;
}): number | null => {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === value) {
      return index;
    }
  }

  return null;
};

const getReplacementTokens = (value: string): ReplacementToken[] => {
  if (!value) {
    return [];
  }

  const tokens: ReplacementToken[] = [];
  let index = 0;

  while (index < value.length) {
    const start = index;
    const isWhitespace = /\s/.test(value[index]);

    while (index < value.length && /\s/.test(value[index]) === isWhitespace) {
      index += 1;
    }

    tokens.push({
      value: value.slice(start, index),
      from: start,
      to: index,
      isWhitespace,
    });
  }

  return tokens;
};

const getAlphanumericPositions = (value: string): number[] => {
  const positions: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    if (isAlphanumericCharacter(value[index])) {
      positions.push(index);
    }
  }

  return positions;
};

const isAlphanumericCharacter = (value: string): boolean => {
  return /[a-z0-9]/i.test(value);
};

const getMergedCharacterRanges = (
  characterPositions: Set<number>,
): Array<{ from: number; to: number }> => {
  const sortedPositions = [...characterPositions].sort((left, right) => left - right);

  if (sortedPositions.length === 0) {
    return [];
  }

  const ranges: Array<{ from: number; to: number }> = [];
  let currentFrom = sortedPositions[0];
  let currentTo = currentFrom + 1;

  for (let index = 1; index < sortedPositions.length; index += 1) {
    const position = sortedPositions[index];

    if (position === currentTo) {
      currentTo += 1;
      continue;
    }

    ranges.push({ from: currentFrom, to: currentTo });
    currentFrom = position;
    currentTo = position + 1;
  }

  ranges.push({ from: currentFrom, to: currentTo });
  return ranges;
};

const getReplacementHighlightOffsets = (
  draftValue: string,
  editorValue: string,
): ReplacementHighlightOffsets => {
  if (
    draftValue.length === editorValue.length + 1 &&
    editorValue === draftValue.slice(0, -1)
  ) {
    return {
      draftFromOffset: draftValue.length - 1,
      draftToOffset: draftValue.length,
      editorFromOffset: editorValue.length,
      editorToOffset: editorValue.length,
    };
  }

  if (draftValue.length > editorValue.length) {
    return getDeletionBiasedReplacementHighlightOffsets(draftValue, editorValue);
  }

  let draftFromOffset = 0;
  let editorFromOffset = 0;

  while (
    draftFromOffset < draftValue.length &&
    editorFromOffset < editorValue.length &&
    draftValue[draftFromOffset] === editorValue[editorFromOffset]
  ) {
    draftFromOffset += 1;
    editorFromOffset += 1;
  }

  let draftToOffset = draftValue.length;
  let editorToOffset = editorValue.length;

  while (
    draftToOffset > draftFromOffset &&
    editorToOffset > editorFromOffset &&
    draftValue[draftToOffset - 1] === editorValue[editorToOffset - 1]
  ) {
    draftToOffset -= 1;
    editorToOffset -= 1;
  }

  return {
    draftFromOffset,
    draftToOffset,
    editorFromOffset,
    editorToOffset,
  };
};

const getDeletionBiasedReplacementHighlightOffsets = (
  draftValue: string,
  editorValue: string,
): ReplacementHighlightOffsets => {
  let draftToOffset = draftValue.length;
  let editorToOffset = editorValue.length;

  while (
    draftToOffset > 0 &&
    editorToOffset > 0 &&
    draftValue[draftToOffset - 1] === editorValue[editorToOffset - 1]
  ) {
    draftToOffset -= 1;
    editorToOffset -= 1;
  }

  let draftFromOffset = 0;
  let editorFromOffset = 0;

  while (
    draftFromOffset < draftToOffset &&
    editorFromOffset < editorToOffset &&
    draftValue[draftFromOffset] === editorValue[editorFromOffset]
  ) {
    draftFromOffset += 1;
    editorFromOffset += 1;
  }

  return {
    draftFromOffset,
    draftToOffset,
    editorFromOffset,
    editorToOffset,
  };
};

const getLineWords = (line: string): string[] => {
  return line
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
};

const getSharedWordRatio = (draftLine: string, editorLine: string): number => {
  const draftWords = new Set(getLineWords(draftLine));
  const editorWords = getLineWords(editorLine);

  if (draftWords.size === 0 && editorWords.length === 0) {
    return 1;
  }

  if (draftWords.size === 0 || editorWords.length === 0) {
    return 0;
  }

  const sharedWordCount = editorWords.filter((word) => draftWords.has(word)).length;
  return sharedWordCount / Math.max(draftWords.size, editorWords.length);
};

const areSimilarLines = (draftLine: string, editorLine: string): boolean => {
  if (draftLine === editorLine) {
    return true;
  }

  const normalizedDraftLine = draftLine.trim();
  const normalizedEditorLine = editorLine.trim();

  if (!normalizedDraftLine || !normalizedEditorLine) {
    return false;
  }

  if (
    normalizedDraftLine.includes(normalizedEditorLine) ||
    normalizedEditorLine.includes(normalizedDraftLine)
  ) {
    return true;
  }

  return getSharedWordRatio(normalizedDraftLine, normalizedEditorLine) >= 0.4;
};

const getLinePairs = (draftText: string, editorText: string): LinePair[] => {
  const draftLines = draftText.split('\n');
  const editorLines = editorText.split('\n');
  const matches = getLineAlignmentMatches(draftLines, editorLines);
  return getLinePairsFromMatches({
    draftLines,
    editorLines,
    matches,
  });
};

const getLineAlignmentMatches = (
  draftLines: string[],
  editorLines: string[],
): LineAlignmentMatch[] => {
  const draftCount = draftLines.length;
  const editorCount = editorLines.length;
  const scores: number[][] = Array.from({ length: draftCount + 1 }, () =>
    Array(editorCount + 1).fill(0),
  );
  const skipPenalty = 1;

  for (let draftIndex = draftCount - 1; draftIndex >= 0; draftIndex -= 1) {
    scores[draftIndex][editorCount] = scores[draftIndex + 1][editorCount] - skipPenalty;
  }

  for (let editorIndex = editorCount - 1; editorIndex >= 0; editorIndex -= 1) {
    scores[draftCount][editorIndex] = scores[draftCount][editorIndex + 1] - skipPenalty;
  }

  for (let draftIndex = draftCount - 1; draftIndex >= 0; draftIndex -= 1) {
    for (let editorIndex = editorCount - 1; editorIndex >= 0; editorIndex -= 1) {
      const skipDraftScore = scores[draftIndex + 1][editorIndex] - skipPenalty;
      const skipEditorScore = scores[draftIndex][editorIndex + 1] - skipPenalty;
      const matchScore = getLineMatchScore(
        draftLines[draftIndex],
        editorLines[editorIndex],
      );
      const withMatchScore =
        matchScore > 0
          ? matchScore + scores[draftIndex + 1][editorIndex + 1]
          : Number.NEGATIVE_INFINITY;

      scores[draftIndex][editorIndex] = Math.max(
        skipDraftScore,
        skipEditorScore,
        withMatchScore,
      );
    }
  }

  const matches: LineAlignmentMatch[] = [];
  let draftIndex = 0;
  let editorIndex = 0;

  while (draftIndex < draftCount && editorIndex < editorCount) {
    const currentScore = scores[draftIndex][editorIndex];
    const matchScore = getLineMatchScore(
      draftLines[draftIndex],
      editorLines[editorIndex],
    );
    const withMatchScore =
      matchScore > 0
        ? matchScore + scores[draftIndex + 1][editorIndex + 1]
        : Number.NEGATIVE_INFINITY;

    if (matchScore === 3 && withMatchScore >= currentScore) {
      matches.push({ draftIndex, editorIndex });
      draftIndex += 1;
      editorIndex += 1;
      continue;
    }

    if (matchScore > 0 && withMatchScore >= currentScore) {
      matches.push({ draftIndex, editorIndex });
      draftIndex += 1;
      editorIndex += 1;
      continue;
    }

    const skipDraftScore = scores[draftIndex + 1][editorIndex] - skipPenalty;
    const skipEditorScore = scores[draftIndex][editorIndex + 1] - skipPenalty;

    if (skipDraftScore >= skipEditorScore) {
      draftIndex += 1;
    } else {
      editorIndex += 1;
    }
  }

  return matches;
};

const getLineMatchScore = (draftLine: string, editorLine: string): number => {
  if (!draftLine.trim() || !editorLine.trim()) {
    return 0;
  }

  if (draftLine === editorLine) {
    return 3;
  }

  if (areSimilarLines(draftLine, editorLine)) {
    return 1;
  }

  return 0;
};

const getLinePairsFromMatches = ({
  draftLines,
  editorLines,
  matches,
}: {
  draftLines: string[];
  editorLines: string[];
  matches: LineAlignmentMatch[];
}): LinePair[] => {
  if (matches.length === 0) {
    return getLinePairsWithoutAnchors(draftLines, editorLines);
  }

  const linePairs: LinePair[] = [];
  let draftIndex = 0;
  let editorIndex = 0;

  for (const match of matches) {
    while (
      draftIndex < match.draftIndex &&
      editorIndex < match.editorIndex &&
      !draftLines[draftIndex].trim() &&
      !editorLines[editorIndex].trim()
    ) {
      linePairs.push({
        draftLine: draftLines[draftIndex],
        editorLine: editorLines[editorIndex],
        draftLineNumber: draftIndex + 1,
        editorLineNumber: editorIndex + 1,
        placement: 'before',
      });
      draftIndex += 1;
      editorIndex += 1;
    }

    while (editorIndex < match.editorIndex) {
      linePairs.push({
        draftLine: null,
        editorLine: editorLines[editorIndex],
        draftLineNumber: match.draftIndex + 1,
        editorLineNumber: editorIndex + 1,
        placement: 'before',
      });
      editorIndex += 1;
    }

    while (draftIndex < match.draftIndex) {
      linePairs.push({
        draftLine: draftLines[draftIndex],
        editorLine: null,
        draftLineNumber: draftIndex + 1,
        editorLineNumber: match.editorIndex + 1,
        placement: 'before',
      });
      draftIndex += 1;
    }

    linePairs.push({
      draftLine: draftLines[match.draftIndex],
      editorLine: editorLines[match.editorIndex],
      draftLineNumber: match.draftIndex + 1,
      editorLineNumber: match.editorIndex + 1,
      placement: 'before',
    });
    draftIndex = match.draftIndex + 1;
    editorIndex = match.editorIndex + 1;
  }

  const trailingBlankPairCount = getCommonTrailingBlankLineCount({
    draftLines,
    editorLines,
    draftStartIndex: draftIndex,
    editorStartIndex: editorIndex,
  });
  const draftTailEndIndex = draftLines.length - trailingBlankPairCount;
  const editorTailEndIndex = editorLines.length - trailingBlankPairCount;

  while (editorIndex < editorTailEndIndex) {
    linePairs.push({
      draftLine: null,
      editorLine: editorLines[editorIndex],
      draftLineNumber: Math.max(1, draftLines.length),
      editorLineNumber: editorIndex + 1,
      placement: 'after',
    });
    editorIndex += 1;
  }

  while (draftIndex < draftTailEndIndex) {
    linePairs.push({
      draftLine: draftLines[draftIndex],
      editorLine: null,
      draftLineNumber: draftIndex + 1,
      editorLineNumber: editorLines.length + 1,
      placement: 'before',
    });
    draftIndex += 1;
  }

  while (draftIndex < draftLines.length && editorIndex < editorLines.length) {
    linePairs.push({
      draftLine: draftLines[draftIndex],
      editorLine: editorLines[editorIndex],
      draftLineNumber: draftIndex + 1,
      editorLineNumber: editorIndex + 1,
      placement: 'after',
    });

    draftIndex += 1;
    editorIndex += 1;
  }

  return linePairs;
};

const getCommonTrailingBlankLineCount = ({
  draftLines,
  editorLines,
  draftStartIndex,
  editorStartIndex,
}: {
  draftLines: string[];
  editorLines: string[];
  draftStartIndex: number;
  editorStartIndex: number;
}): number => {
  let count = 0;

  while (
    draftLines.length - count - 1 >= draftStartIndex &&
    editorLines.length - count - 1 >= editorStartIndex
  ) {
    const draftLine = draftLines[draftLines.length - count - 1] ?? '';
    const editorLine = editorLines[editorLines.length - count - 1] ?? '';

    if (draftLine.trim() || editorLine.trim()) {
      break;
    }

    count += 1;
  }

  return count;
};

const getLinePairsWithoutAnchors = (
  draftLines: string[],
  editorLines: string[],
): LinePair[] => {
  const linePairs: LinePair[] = [];
  const sharedLineCount = Math.min(draftLines.length, editorLines.length);

  for (let index = 0; index < sharedLineCount; index += 1) {
    linePairs.push({
      draftLine: draftLines[index],
      editorLine: editorLines[index],
      draftLineNumber: index + 1,
      editorLineNumber: index + 1,
      placement: 'before',
    });
  }

  for (let index = sharedLineCount; index < editorLines.length; index += 1) {
    linePairs.push({
      draftLine: null,
      editorLine: editorLines[index],
      draftLineNumber: Math.max(1, draftLines.length),
      editorLineNumber: index + 1,
      placement: 'after',
    });
  }

  for (let index = sharedLineCount; index < draftLines.length; index += 1) {
    linePairs.push({
      draftLine: draftLines[index],
      editorLine: null,
      draftLineNumber: index + 1,
      editorLineNumber: editorLines.length + 1,
      placement: 'before',
    });
  }

  return linePairs;
};

const isDraftLineTextPreservedNearPair = (
  linePairs: LinePair[],
  linePairIndex: number,
): boolean => {
  const linePair = linePairs[linePairIndex];
  if (linePair.draftLine === null || linePair.editorLine !== null) {
    return false;
  }

  const normalizedDraftLine = getNormalizedVisibleLineText(linePair.draftLine);
  if (!normalizedDraftLine) {
    return false;
  }

  for (let offset = -2; offset <= 2; offset += 1) {
    if (offset === 0) {
      continue;
    }
    const nearbyPair = linePairs[linePairIndex + offset];
    if (!nearbyPair || nearbyPair.editorLine === null) {
      continue;
    }

    const normalizedEditorLine = getNormalizedVisibleLineText(nearbyPair.editorLine);
    if (
      normalizedEditorLine.includes(normalizedDraftLine) ||
      hasSimilarVisibleToken(normalizedDraftLine, nearbyPair.editorLine)
    ) {
      return true;
    }
  }

  return false;
};

const getNormalizedVisibleLineText = (line: string): string => {
  return line.replace(/\s+/g, '').toLowerCase();
};

const getPreviousDraftLineNumber = (
  linePairs: LinePair[],
  linePairIndex: number,
): number => {
  for (let index = linePairIndex - 1; index >= 0; index -= 1) {
    const linePair = linePairs[index];
    if (linePair?.draftLine !== null) {
      return linePair.draftLineNumber;
    }
  }

  return 0;
};

const hasSimilarVisibleToken = (
  normalizedDraftLine: string,
  editorLine: string,
): boolean => {
  const normalizedEditorLine = getNormalizedVisibleLineText(editorLine);
  if (areSimilarVisibleTexts(normalizedDraftLine, normalizedEditorLine)) {
    return true;
  }

  const editorTokens = editorLine
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  return editorTokens.some((token) => areSimilarVisibleTexts(normalizedDraftLine, token));
};

const areSimilarVisibleTexts = (left: string, right: string): boolean => {
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }

  return getStringLcsLength(left, right) / Math.max(left.length, right.length) >= 0.75;
};

const getStringLcsLength = (left: string, right: string): number => {
  const scores: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0),
  );

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      if (left[leftIndex] === right[rightIndex]) {
        scores[leftIndex][rightIndex] = 1 + scores[leftIndex + 1][rightIndex + 1];
      } else {
        scores[leftIndex][rightIndex] = Math.max(
          scores[leftIndex + 1][rightIndex],
          scores[leftIndex][rightIndex + 1],
        );
      }
    }
  }

  return scores[0][0];
};

const getDraftLineDecorationKey = (
  decoration: DraftLineDecoration,
): string => {
  return `${decoration.type}:${decoration.lineNumber}:${decoration.placement}`;
};

const getEditorText = (displayChanges: DisplayChange[]): string => {
  return displayChanges.map((displayChange) => displayChange.editorValue).join('');
};

const getVisibleEditorRangeSegments = ({
  text,
  basePosition,
}: {
  text: string;
  basePosition: number;
}): EditorHighlightRange[] => {
  const ranges: EditorHighlightRange[] = [];
  let segmentStart = 0;

  for (let index = 0; index <= text.length; index += 1) {
    const isSegmentBreak = index === text.length || text[index] === '\n';
    if (!isSegmentBreak) {
      continue;
    }

    const segment = text.slice(segmentStart, index);
    if (segment.trim().length > 0) {
      ranges.push({
        type: 'added',
        from: basePosition + segmentStart,
        to: basePosition + index,
      });
    }
    segmentStart = index + 1;
  }

  return ranges;
};

const getVisibleEditorRanges = (
  ranges: EditorHighlightRange[],
  editorText: string,
): EditorHighlightRange[] => {
  const visibleRanges: EditorHighlightRange[] = [];

  for (const range of ranges) {
    if (range.type !== 'added') {
      visibleRanges.push(range);
      continue;
    }

    const text = editorText.slice(range.from, range.to);
    visibleRanges.push(
      ...getVisibleEditorRangeSegments({
        text,
        basePosition: range.from,
      }),
    );
  }

  return visibleRanges;
};

const isMergeableInlineHighlightGap = (gapText: string): boolean => {
  if (!gapText || /[\n\r]/.test(gapText)) {
    return false;
  }

  for (const character of gapText) {
    if (character === ' ' || character === '\t') {
      continue;
    }
    if (/[a-z0-9]/i.test(character)) {
      return false;
    }
    if (/[\p{P}\p{S}]/u.test(character)) {
      continue;
    }
    return false;
  }

  return true;
};

const mergeAddedRangesAcrossInlineGaps = (
  ranges: EditorHighlightRange[],
  editorText: string,
): EditorHighlightRange[] => {
  if (ranges.length <= 1) {
    return ranges;
  }

  const mergedRanges: EditorHighlightRange[] = [];
  let index = 0;

  while (index < ranges.length) {
    const currentRange = ranges[index];

    if (currentRange.type !== 'added') {
      mergedRanges.push(currentRange);
      index += 1;
      continue;
    }

    let mergedRange: EditorHighlightRange = { ...currentRange };
    let nextIndex = index + 1;

    while (nextIndex < ranges.length) {
      const nextRange = ranges[nextIndex];
      if (nextRange.type !== 'added') {
        break;
      }

      const gapText = editorText.slice(mergedRange.to, nextRange.from);
      if (!isMergeableInlineHighlightGap(gapText)) {
        break;
      }

      mergedRange = {
        type: 'added',
        from: mergedRange.from,
        to: nextRange.to,
      };
      nextIndex += 1;
    }

    mergedRanges.push(mergedRange);
    index = nextIndex;
  }

  return mergedRanges;
};

const mergeDeletedRangesAcrossInlineGaps = (
  ranges: DraftHighlightRange[],
  draftText: string,
): DraftHighlightRange[] => {
  const deletedRanges = ranges.filter((range) => range.type === 'deleted');
  const addedRanges = ranges.filter((range) => range.type === 'added');

  if (deletedRanges.length <= 1) {
    return [...deletedRanges, ...addedRanges].sort(compareDraftHighlightRanges);
  }

  const mergedRanges: DraftHighlightRange[] = [];
  let index = 0;

  while (index < deletedRanges.length) {
    const currentRange = deletedRanges[index];

    const mergedFrom = currentRange.from;
    let mergedTo = currentRange.to;
    let nextIndex = index + 1;

    while (nextIndex < deletedRanges.length) {
      const nextRange = deletedRanges[nextIndex];
      const gapText = draftText.slice(mergedTo, nextRange.from);
      if (!isMergeableInlineHighlightGap(gapText)) {
        break;
      }

      mergedTo = nextRange.to;
      nextIndex += 1;
    }

    const normalizedMergedTo = getNormalizedDeletedRangeEnd({
      draftText,
      from: mergedFrom,
      to: mergedTo,
    });

    mergedRanges.push({
      type: 'deleted',
      from: mergedFrom,
      to: normalizedMergedTo,
    });
    index = nextIndex;
  }

  return [...mergedRanges, ...addedRanges].sort(compareDraftHighlightRanges);
};

const filterVisibleDraftDeletedRanges = (
  ranges: DraftHighlightRange[],
  draftText: string,
): DraftHighlightRange[] => {
  return ranges.filter((range) => {
    if (range.type === 'added') {
      return true;
    }
    return draftText.slice(range.from, range.to).trim().length > 0;
  });
};

const getDraftText = (displayChanges: DisplayChange[]): string => {
  return displayChanges.map((displayChange) => displayChange.draftValue).join('');
};

const getNormalizedDeletedRangeEnd = ({
  draftText,
  from,
  to,
}: {
  draftText: string;
  from: number;
  to: number;
}): number => {
  if (to <= from) {
    return to;
  }

  const trailingCharacter = draftText[to - 1];
  const nextCharacter = draftText[to];

  if ((trailingCharacter === ' ' || trailingCharacter === '\t') && nextCharacter) {
    return to - 1;
  }

  return to;
};

const compareDraftHighlightRanges = (
  left: DraftHighlightRange,
  right: DraftHighlightRange,
): number => {
  const fromDifference = left.from - right.from;
  if (fromDifference !== 0) {
    return fromDifference;
  }

  const toDifference = left.to - right.to;
  if (toDifference !== 0) {
    return toDifference;
  }

  if (left.type === right.type) {
    return 0;
  }

  return left.type === 'deleted' ? -1 : 1;
};

const hasEmptyEditorReplacementSpan = (
  offsets: ReplacementHighlightOffsets,
): boolean => {
  return offsets.editorToOffset <= offsets.editorFromOffset;
};

const hasEmptyDraftReplacementSpan = (
  offsets: ReplacementHighlightOffsets,
): boolean => {
  return offsets.draftToOffset <= offsets.draftFromOffset;
};

const isWhitespaceOnlyReplacement = (
  draftValue: string,
  editorValue: string,
): boolean => {
  return draftValue.trim() === '' && editorValue.trim() === '';
};

const isFullLineMarkerChange = (value: string): boolean => {
  return value.includes('\n') && /\S/.test(value);
};

const shouldRenderEditorDeletedMarker = (value: string): boolean => {
  return value.length > 0 && !isFullLineMarkerChange(value);
};

const shouldRenderDraftAddedMarker = (value: string): boolean => {
  return value.length > 0 && !isFullLineMarkerChange(value);
};

const mergeRawChanges = (changes: RawChange[]): RawChange[] => {
  const mergedChanges: RawChange[] = [];

  for (const change of changes) {
    const previousChange = mergedChanges[mergedChanges.length - 1];

    if (previousChange && previousChange.type === change.type) {
      previousChange.value += change.value;
      continue;
    }

    mergedChanges.push({ ...change });
  }

  return mergedChanges;
};

const shouldPairAsReplacement = (
  currentValue: string,
  nextValue: string,
): boolean => {
  if (!currentValue.includes('\n') && !nextValue.includes('\n')) {
    return true;
  }

  const withoutNewlinesLeft = currentValue.replace(/\n/g, '');
  const withoutNewlinesRight = nextValue.replace(/\n/g, '');
  return (
    withoutNewlinesLeft.includes(withoutNewlinesRight) ||
    withoutNewlinesRight.includes(withoutNewlinesLeft)
  );
};

const combineWhitespaceBridgedChanges = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const combinedChanges: DisplayChange[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const previousChange = changes[index];
    const whitespaceChange = changes[index + 1];
    const nextChange = changes[index + 2];

    const canBridge =
      whitespaceChange &&
      nextChange &&
      previousChange.type === nextChange.type &&
      previousChange.type !== 'equal' &&
      whitespaceChange.type === 'equal' &&
      whitespaceChange.draftValue === whitespaceChange.editorValue &&
      /^[ \t]+$/.test(whitespaceChange.editorValue) &&
      whitespaceChange.editorValue.length <= 1;

    if (!canBridge) {
      combinedChanges.push({ ...previousChange });
      continue;
    }

    combinedChanges.push({
      type: previousChange.type,
      draftValue:
        previousChange.draftValue +
        whitespaceChange.draftValue +
        nextChange.draftValue,
      editorValue:
        previousChange.editorValue +
        whitespaceChange.editorValue +
        nextChange.editorValue,
    });

    index += 2;
  }

  return mergeDisplayChanges(combinedChanges);
};

const combineReplacementInsertions = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const combinedChanges: DisplayChange[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const replacementChange = changes[index];
    if (replacementChange.type !== 'replaced') {
      combinedChanges.push({ ...replacementChange });
      continue;
    }

    let bridgeWhitespace = '';
    let insertedIndex = index + 1;

    const maybeWhitespaceEqual = changes[insertedIndex];
    if (
      maybeWhitespaceEqual &&
      maybeWhitespaceEqual.type === 'equal' &&
      maybeWhitespaceEqual.draftValue === maybeWhitespaceEqual.editorValue &&
      /^[ \t]+$/.test(maybeWhitespaceEqual.editorValue)
    ) {
      bridgeWhitespace = maybeWhitespaceEqual.editorValue;
      insertedIndex += 1;
    }

    const insertedChange = changes[insertedIndex];
    const equalChange = changes[insertedIndex + 1];

    const canCombine =
      insertedChange &&
      insertedChange.type === 'inserted' &&
      equalChange &&
      equalChange.type === 'equal' &&
      /[ \t]+$/.test(insertedChange.editorValue) &&
      !equalChange.editorValue.startsWith('\n');

    if (!canCombine) {
      combinedChanges.push({ ...replacementChange });
      continue;
    }

    const trailingWhitespaceMatch = insertedChange.editorValue.match(/[ \t]+$/);
    const trailingWhitespace = trailingWhitespaceMatch?.[0] ?? '';
    const insertedCore = insertedChange.editorValue.slice(
      0,
      insertedChange.editorValue.length - trailingWhitespace.length,
    );

    combinedChanges.push({
      type: 'replaced',
      draftValue: replacementChange.draftValue,
      editorValue: replacementChange.editorValue + bridgeWhitespace + insertedCore,
    });

    combinedChanges.push({
      type: 'equal',
      draftValue: trailingWhitespace + equalChange.draftValue,
      editorValue: trailingWhitespace + equalChange.editorValue,
    });

    index = insertedIndex + 1;
  }

  return mergeDisplayChanges(combinedChanges);
};

const normalizeReplacementWhitespace = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const normalizedChanges: DisplayChange[] = [];

  for (const change of changes) {
    if (change.type !== 'replaced') {
      normalizedChanges.push(change);
      continue;
    }

    const { leadingWhitespace, trailingWhitespace, draftCore, editorCore } =
      splitReplacementBoundaries(change.draftValue, change.editorValue);

    if (leadingWhitespace) {
      normalizedChanges.push({
        type: 'equal',
        draftValue: leadingWhitespace,
        editorValue: leadingWhitespace,
      });
    }

    if (draftCore || editorCore) {
      normalizedChanges.push({
        type: 'replaced',
        draftValue: draftCore,
        editorValue: editorCore,
      });
    }

    if (trailingWhitespace) {
      normalizedChanges.push({
        type: 'equal',
        draftValue: trailingWhitespace,
        editorValue: trailingWhitespace,
      });
    }
  }

  return mergeDisplayChanges(normalizedChanges);
};

const splitReplacementBoundaries = (draftValue: string, editorValue: string) => {
  let draftStart = 0;
  let editorStart = 0;

  while (
    draftStart < draftValue.length &&
    editorStart < editorValue.length &&
    draftValue[draftStart] === editorValue[editorStart] &&
    /\s/.test(draftValue[draftStart])
  ) {
    draftStart += 1;
    editorStart += 1;
  }

  let draftEnd = draftValue.length - 1;
  let editorEnd = editorValue.length - 1;

  while (
    draftEnd >= draftStart &&
    editorEnd >= editorStart &&
    draftValue[draftEnd] === editorValue[editorEnd] &&
    /\s/.test(draftValue[draftEnd])
  ) {
    draftEnd -= 1;
    editorEnd -= 1;
  }

  return {
    leadingWhitespace: draftValue.slice(0, draftStart),
    trailingWhitespace: draftValue.slice(draftEnd + 1),
    draftCore: draftValue.slice(draftStart, draftEnd + 1),
    editorCore: editorValue.slice(editorStart, editorEnd + 1),
  };
};

const normalizeInsertedWhitespace = (changes: DisplayChange[]): DisplayChange[] => {
  const normalizedChanges = changes.map((change) => ({ ...change }));

  for (let index = 1; index < normalizedChanges.length - 1; index += 1) {
    const previousChange = normalizedChanges[index - 1];
    const currentChange = normalizedChanges[index];
    const nextChange = normalizedChanges[index + 1];

    if (
      previousChange.type !== 'equal' ||
      currentChange.type !== 'inserted' ||
      nextChange.type !== 'equal'
    ) {
      continue;
    }

    if (
      !previousChange.editorValue.endsWith(' ') ||
      currentChange.editorValue.startsWith(' ') ||
      !currentChange.editorValue.endsWith(' ') ||
      nextChange.editorValue.startsWith('\n')
    ) {
      continue;
    }

    previousChange.draftValue = previousChange.draftValue.slice(0, -1);
    previousChange.editorValue = previousChange.editorValue.slice(0, -1);
    currentChange.editorValue = ` ${currentChange.editorValue.slice(0, -1)}`;
    nextChange.draftValue = ` ${nextChange.draftValue}`;
    nextChange.editorValue = ` ${nextChange.editorValue}`;
  }

  return mergeDisplayChanges(normalizedChanges);
};

const normalizeRepeatedLineReplacements = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const normalizedChanges: DisplayChange[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const deletedChange = changes[index];
    const newlineChange = changes[index + 1];
    const replacedChange = changes[index + 2];

    if (
      deletedChange &&
      newlineChange &&
      replacedChange &&
      deletedChange.type === 'deleted' &&
      newlineChange.type === 'equal' &&
      newlineChange.draftValue === '\n' &&
      replacedChange.type === 'replaced' &&
      deletedChange.draftValue === replacedChange.editorValue &&
      !deletedChange.draftValue.includes('\n') &&
      !deletedChange.draftValue.includes(' ')
    ) {
      normalizedChanges.push({
        type: 'inserted',
        draftValue: '',
        editorValue: '\n',
      });
      normalizedChanges.push({
        type: 'equal',
        draftValue: deletedChange.draftValue,
        editorValue: deletedChange.draftValue,
      });
      normalizedChanges.push({
        type: 'deleted',
        draftValue: `\n${replacedChange.draftValue}`,
        editorValue: '',
      });
      index += 2;
      continue;
    }

    const insertedChange = changes[index + 2];
    if (
      deletedChange &&
      newlineChange &&
      insertedChange &&
      deletedChange.type === 'deleted' &&
      newlineChange.type === 'equal' &&
      newlineChange.draftValue === '\n' &&
      insertedChange.type === 'inserted' &&
      insertedChange.editorValue.startsWith(deletedChange.draftValue) &&
      !deletedChange.draftValue.includes('\n')
    ) {
      const insertedTail = insertedChange.editorValue.slice(deletedChange.draftValue.length);
      normalizedChanges.push({
        type: 'equal',
        draftValue: deletedChange.draftValue,
        editorValue: deletedChange.draftValue,
      });
      if (insertedTail || newlineChange.draftValue) {
        normalizedChanges.push({
          type: 'replaced',
          draftValue: newlineChange.draftValue,
          editorValue: insertedTail,
        });
      }
      index += 2;
      continue;
    }

    normalizedChanges.push({ ...deletedChange });
  }

  return mergeDisplayChanges(normalizedChanges);
};

const normalizeInsertedLineBeforeJoinedDraftLines = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const normalizedChanges: DisplayChange[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const replacedLine = changes[index];
    const equalNewline = changes[index + 1];
    const followingChange = changes[index + 2];

    if (
      !replacedLine ||
      !equalNewline ||
      !followingChange ||
      replacedLine.type !== 'replaced' ||
      equalNewline.type !== 'equal' ||
      equalNewline.draftValue !== '\n' ||
      replacedLine.draftValue.includes('\n') ||
      replacedLine.editorValue.includes('\n') ||
      replacedLine.draftValue.trim() === '' ||
      replacedLine.editorValue.trim() === ''
    ) {
      normalizedChanges.push({ ...changes[index] });
      continue;
    }

    const preservedPrefix = `${replacedLine.draftValue} `;
    if (
      (followingChange.type !== 'inserted' && followingChange.type !== 'replaced') ||
      !followingChange.editorValue.startsWith(preservedPrefix)
    ) {
      normalizedChanges.push({ ...changes[index] });
      continue;
    }

    const followingEditorRemainder = followingChange.editorValue.slice(
      preservedPrefix.length,
    );
    const followingDraftValue =
      followingChange.type === 'replaced' ? followingChange.draftValue : '';

    normalizedChanges.push({
      type: 'inserted',
      draftValue: '',
      editorValue: `${replacedLine.editorValue}\n`,
    });
    normalizedChanges.push({
      type: 'equal',
      draftValue: replacedLine.draftValue,
      editorValue: replacedLine.draftValue,
    });
    normalizedChanges.push({
      type: 'replaced',
      draftValue: '\n',
      editorValue: ' ',
    });
    if (followingDraftValue || followingEditorRemainder) {
      normalizedChanges.push({
        type: followingChange.type,
        draftValue: followingDraftValue,
        editorValue: followingEditorRemainder,
      });
    }

    index += 2;
  }

  return mergeDisplayChanges(normalizedChanges);
};

const collapseNoisySingleLineReplacements = (
  changes: DisplayChange[],
): DisplayChange[] => {
  const collapsedChanges: DisplayChange[] = [];
  let index = 0;

  while (index < changes.length) {
    const currentChange = changes[index];
    if (currentChange.type === 'equal' && currentChange.editorValue.includes('\n')) {
      collapsedChanges.push({ ...currentChange });
      index += 1;
      continue;
    }

    const segment: DisplayChange[] = [];
    while (index < changes.length) {
      const segmentChange = changes[index];
      if (segmentChange.editorValue.includes('\n') || segmentChange.draftValue.includes('\n')) {
        break;
      }
      segment.push(segmentChange);
      index += 1;
    }

    if (segment.length === 0) {
      collapsedChanges.push({ ...changes[index] });
      index += 1;
      continue;
    }

    if (shouldCollapseNoisyRewrite(segment)) {
      collapsedChanges.push({
        type: 'replaced',
        draftValue: segment.map((change) => change.draftValue).join(''),
        editorValue: segment.map((change) => change.editorValue).join(''),
      });
    } else {
      collapsedChanges.push(...segment.map((change) => ({ ...change })));
    }
  }

  return mergeDisplayChanges(collapsedChanges);
};

const shouldCollapseNoisyRewrite = (changes: DisplayChange[]): boolean => {
  const draftText = changes.map((change) => change.draftValue).join('');
  const editorText = changes.map((change) => change.editorValue).join('');
  if (!draftText || !editorText || draftText.includes('\n') || editorText.includes('\n')) {
    return false;
  }

  const draftWordCount = getWordCount(draftText);
  const editorWordCount = getWordCount(editorText);
  if (Math.max(draftWordCount, editorWordCount) < 6) {
    return false;
  }

  const meaningfulSharedRatio = getSharedTokenRatio(
    getMeaningfulTokens(draftText),
    getMeaningfulTokens(editorText),
  );
  if (meaningfulSharedRatio >= 0.35) {
    return false;
  }

  const equalFragments = changes
    .filter((change) => change.type === 'equal')
    .map((change) => change.editorValue.trim())
    .filter(Boolean);
  if (equalFragments.length < 1) {
    return false;
  }

  const totalEqualLength = equalFragments.reduce((sum, fragment) => sum + fragment.length, 0);
  if (totalEqualLength > Math.max(draftText.length, editorText.length) * 0.3) {
    return false;
  }

  return equalFragments.every((fragment) => {
    const tokens = fragment.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }
    return tokens.every((token) => token.length <= 4 || COMMON_NOISY_TOKENS.has(token));
  });
};

const getMeaningfulTokens = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4 && !COMMON_NOISY_TOKENS.has(token));
};

const getSharedTokenRatio = (draftTokens: string[], editorTokens: string[]): number => {
  if (draftTokens.length === 0 || editorTokens.length === 0) {
    return 0;
  }

  const draftSet = new Set(draftTokens);
  let sharedCount = 0;
  for (const token of new Set(editorTokens)) {
    if (draftSet.has(token)) {
      sharedCount += 1;
    }
  }

  return sharedCount / Math.max(new Set(draftTokens).size, new Set(editorTokens).size);
};

const COMMON_NOISY_TOKENS = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'from',
  'have',
  'his',
  'name',
  'that',
  'the',
  'their',
  'there',
  'they',
  'this',
  'was',
  'were',
  'with',
]);

const getCharacterReplacementEditorRanges = ({
  draftValue,
  editorValue,
  editorPosition,
}: {
  draftValue: string;
  editorValue: string;
  editorPosition: number;
}): EditorHighlightRange[] | null => {
  const wholeWordRanges = getWholeWordReplacementRanges({
    draftValue,
    editorValue,
  });
  if (wholeWordRanges) {
    return wholeWordRanges.editorRanges.map((range) => ({
      type: 'added',
      from: editorPosition + range.from,
      to: editorPosition + range.to,
    }));
  }

  const ranges = getCharacterReplacementRanges(draftValue, editorValue);
  if (!ranges) {
    return null;
  }

  if (ranges.editorRanges.length > 0) {
    return ranges.editorRanges.map((range) => ({
      type: 'added',
      from: editorPosition + range.from,
      to: editorPosition + range.to,
    }));
  }

  if (ranges.draftRanges.length > 0) {
    const deletedText = ranges.draftRanges
      .map((range) => draftValue.slice(range.from, range.to))
      .join('');
    if (
      deletedText.trim().length === 0 ||
      shouldRenderEditorDeletedMarker(draftValue)
    ) {
    const markerOffset = ranges.draftRanges[0].from;
    return [
      {
        type: 'deleted',
        from: editorPosition + markerOffset,
        to: editorPosition + markerOffset,
      },
    ];
    }
  }

  return [];
};

const getCharacterReplacementDraftRanges = ({
  draftValue,
  editorValue,
  draftPosition,
}: {
  draftValue: string;
  editorValue: string;
  draftPosition: number;
}): DraftHighlightRange[] | null => {
  const wholeWordRanges = getWholeWordReplacementRanges({
    draftValue,
    editorValue,
  });
  if (wholeWordRanges) {
    return wholeWordRanges.draftRanges.map((range) => ({
      type: 'deleted',
      from: draftPosition + range.from,
      to: draftPosition + range.to,
    }));
  }

  const ranges = getCharacterReplacementRanges(draftValue, editorValue);
  if (!ranges) {
    return null;
  }

  if (ranges.draftRanges.length > 0) {
    return ranges.draftRanges.map((range) => ({
      type: 'deleted',
      from: draftPosition + range.from,
      to: draftPosition + range.to,
    }));
  }

  if (ranges.editorRanges.length > 0 && shouldRenderDraftAddedMarker(editorValue)) {
    const markerOffset = ranges.editorRanges[0].from;
    return [
      {
        type: 'added',
        from: draftPosition + markerOffset,
        to: draftPosition + markerOffset,
      },
    ];
  }

  return [];
};

const getCharacterReplacementRanges = (
  draftValue: string,
  editorValue: string,
): ReplacementRangePair | null => {
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
  const lcsLength = matches.length;
  const longestLength = Math.max(draftValue.length, editorValue.length);
  if (lcsLength / longestLength < 0.5) {
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
): Array<{ draftIndex: number; editorIndex: number }> => {
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
      if (draftValue[draftIndex] === editorValue[editorIndex]) {
        scores[draftIndex][editorIndex] = Math.max(
          bestWithoutMatch,
          1 + scores[draftIndex + 1][editorIndex + 1],
        );
      } else {
        scores[draftIndex][editorIndex] = bestWithoutMatch;
      }
    }
  }

  const matches: Array<{ draftIndex: number; editorIndex: number }> = [];
  let draftIndex = 0;
  let editorIndex = 0;
  while (draftIndex < draftCount && editorIndex < editorCount) {
    if (
      draftValue[draftIndex] === editorValue[editorIndex] &&
      scores[draftIndex][editorIndex] === 1 + scores[draftIndex + 1][editorIndex + 1]
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
): Array<{ from: number; to: number }> => {
  const matchedSet = new Set(matchedIndexes);
  const ranges: Array<{ from: number; to: number }> = [];
  let from: number | null = null;

  for (let index = 0; index < length; index += 1) {
    if (!matchedSet.has(index)) {
      if (from === null) {
        from = index;
      }
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

const mergeDisplayChanges = (changes: DisplayChange[]): DisplayChange[] => {
  const mergedChanges: DisplayChange[] = [];

  for (const change of changes) {
    const previousChange = mergedChanges[mergedChanges.length - 1];

    if (!previousChange || previousChange.type !== change.type) {
      mergedChanges.push({ ...change });
      continue;
    }

    previousChange.draftValue += change.draftValue;
    previousChange.editorValue += change.editorValue;
  }

  return mergedChanges;
};
