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

export type EditorLineDecoration = {
  lineNumber: number;
};

export type DraftLineDecorationPlacement = 'before' | 'after';

export type DraftLineDecorationType = 'missingEditorLine' | 'deletedDraftLine';

export type DraftLineDecoration = {
  type: DraftLineDecorationType;
  lineNumber: number;
  placement: DraftLineDecorationPlacement;
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

const lineLookaheadLimit = 3;

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
        (currentChange.type === 'inserted' && nextChange.type === 'deleted'))
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

  return normalizeReplacementWhitespace(combinedChanges);
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

    if (displayChange.type === 'inserted' || displayChange.type === 'replaced') {
      const from = editorPosition;
      const to = from + displayChange.editorValue.length;

      if (to > from) {
        ranges.push({ type: 'added', from, to });
      }

      editorPosition = to;
      continue;
    }

    const markerPosition = getDeletedMarkerPosition(editorText, editorPosition);

    ranges.push({ type: 'deleted', from: markerPosition, to: markerPosition });
  }

  return mergeAddedRangesAcrossSingleSpace(ranges, editorText);
};

export const getLineDecorations = (
  draftText: string,
  editorText: string,
): {
  editorLineDecorations: EditorLineDecoration[];
  draftLineDecorations: DraftLineDecoration[];
} => {
  const linePairs = getLinePairs(draftText, editorText);
  const editorLineDecorations: EditorLineDecoration[] = [];
  const draftLineDecorations: DraftLineDecoration[] = [];
  const draftLineDecorationKeys = new Set<string>();

  for (const linePair of linePairs) {
    if (linePair.draftLine === null && linePair.editorLine !== null) {
      editorLineDecorations.push({ lineNumber: linePair.editorLineNumber });
      const decoration: DraftLineDecoration = {
        type: 'missingEditorLine',
        lineNumber: Math.max(1, linePair.draftLineNumber),
        placement: linePair.placement,
      };
      const decorationKey = getDraftLineDecorationKey(decoration);
      if (!draftLineDecorationKeys.has(decorationKey)) {
        draftLineDecorationKeys.add(decorationKey);
        draftLineDecorations.push(decoration);
      }
      continue;
    }

    if (linePair.draftLine !== null && linePair.editorLine === null) {
      const decoration: DraftLineDecoration = {
        type: 'deletedDraftLine',
        lineNumber: linePair.draftLineNumber,
        placement: 'before',
      };
      const decorationKey = getDraftLineDecorationKey(decoration);
      if (!draftLineDecorationKeys.has(decorationKey)) {
        draftLineDecorationKeys.add(decorationKey);
        draftLineDecorations.push(decoration);
      }
    }
  }

  return { editorLineDecorations, draftLineDecorations };
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

  return getSharedWordRatio(normalizedDraftLine, normalizedEditorLine) > 0.5;
};

const findSimilarLineIndex = ({
  lines,
  targetLine,
  startIndex,
}: {
  lines: string[];
  targetLine: string;
  startIndex: number;
}): number | null => {
  const endIndex = Math.min(lines.length, startIndex + lineLookaheadLimit);

  for (let index = startIndex; index < endIndex; index += 1) {
    if (areSimilarLines(lines[index], targetLine)) {
      return index;
    }
  }

  return null;
};

const getLinePairs = (draftText: string, editorText: string): LinePair[] => {
  const draftLines = draftText.split('\n');
  const editorLines = editorText.split('\n');
  const linePairs: LinePair[] = [];

  let draftIndex = 0;
  let editorIndex = 0;

  while (draftIndex < draftLines.length && editorIndex < editorLines.length) {
    const draftLine = draftLines[draftIndex];
    const editorLine = editorLines[editorIndex];
    const draftLineNumber = draftIndex + 1;
    const editorLineNumber = editorIndex + 1;

    if (areSimilarLines(draftLine, editorLine)) {
      linePairs.push({
        draftLine,
        editorLine,
        draftLineNumber,
        editorLineNumber,
        placement: 'before',
      });
      draftIndex += 1;
      editorIndex += 1;
      continue;
    }

    const draftMatchInEditor = findSimilarLineIndex({
      lines: editorLines,
      targetLine: draftLine,
      startIndex: editorIndex + 1,
    });
    if (draftMatchInEditor !== null) {
      while (editorIndex < draftMatchInEditor) {
        linePairs.push({
          draftLine: null,
          editorLine: editorLines[editorIndex],
          draftLineNumber,
          editorLineNumber: editorIndex + 1,
          placement: 'before',
        });
        editorIndex += 1;
      }
      continue;
    }

    const editorMatchInDraft = findSimilarLineIndex({
      lines: draftLines,
      targetLine: editorLine,
      startIndex: draftIndex + 1,
    });
    if (editorMatchInDraft !== null) {
      while (draftIndex < editorMatchInDraft) {
        linePairs.push({
          draftLine: draftLines[draftIndex],
          editorLine: null,
          draftLineNumber: draftIndex + 1,
          editorLineNumber,
          placement: 'before',
        });
        draftIndex += 1;
      }
      continue;
    }

    linePairs.push({
      draftLine,
      editorLine,
      draftLineNumber,
      editorLineNumber,
      placement: 'before',
    });
    draftIndex += 1;
    editorIndex += 1;
  }

  while (editorIndex < editorLines.length) {
    linePairs.push({
      draftLine: null,
      editorLine: editorLines[editorIndex],
      draftLineNumber: Math.max(1, draftLines.length),
      editorLineNumber: editorIndex + 1,
      placement: 'after',
    });
    editorIndex += 1;
  }

  while (draftIndex < draftLines.length) {
    linePairs.push({
      draftLine: draftLines[draftIndex],
      editorLine: null,
      draftLineNumber: draftIndex + 1,
      editorLineNumber: editorIndex + 1,
      placement: 'before',
    });
    draftIndex += 1;
  }

  return linePairs;
};

const getDraftLineDecorationKey = (decoration: DraftLineDecoration): string => {
  return `${decoration.type}:${decoration.lineNumber}:${decoration.placement}`;
};

const getEditorText = (displayChanges: DisplayChange[]): string => {
  return displayChanges.map((displayChange) => displayChange.editorValue).join('');
};

const getDeletedMarkerPosition = (
  editorText: string,
  editorPosition: number,
): number => {
  if (editorPosition <= 0) {
    return editorPosition;
  }

  const previousCharacter = editorText.at(editorPosition - 1);

  if (previousCharacter === ' ' || previousCharacter === '\t') {
    return editorPosition - 1;
  }

  return editorPosition;
};

const mergeAddedRangesAcrossSingleSpace = (
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
      if (gapText !== ' ' && gapText !== '\t') {
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
