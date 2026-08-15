import {
  DEFAULT_DRAFT_TEXT,
  DEFAULT_EDITOR_TEXT,
  type StoredDocumentText,
} from './storage';

export const EXAMPLE_DRAFT_TEXT = `Dreams
by Langston Hughes

Hold fast too dreams
For if dreams die,
Life is a broken winged bird
That can not fly
Hold fast to dreams
For when dreams go
life's a barren field
Froze with snow`;

export const EXAMPLE_EDITOR_TEXT = `Dreams
by Langston Hughes

Hold fast to dreams
For if dreams die
Life is a broken-winged bird
That cannot fly.

Hold fast to dreams
For when dreams go
Life is a barren field
Frozen with snow.`;

export type ExampleCommandPlacement = 'first' | 'last' | null;

const EXAMPLE_COMMAND_SIMILARITY_THRESHOLD = 0.7;

export const getExampleCommandPlacement = ({
  documentText,
  hasUsedExample,
}: {
  documentText: StoredDocumentText;
  hasUsedExample: boolean;
}): ExampleCommandPlacement => {
  if (!canUseExampleCommand(documentText)) {
    return null;
  }

  return hasUsedExample ? 'last' : 'first';
};

export const getExampleDocumentText = (): StoredDocumentText => ({
  draftText: EXAMPLE_DRAFT_TEXT,
  editorText: EXAMPLE_EDITOR_TEXT,
});

const canUseExampleCommand = (documentText: StoredDocumentText): boolean => {
  if (
    isBlankOrInProgressCommand(documentText.draftText) &&
    isBlankOrInProgressCommand(documentText.editorText)
  ) {
    return true;
  }

  return (
    isSimilarDocumentPair(documentText, {
      draftText: DEFAULT_DRAFT_TEXT,
      editorText: DEFAULT_EDITOR_TEXT,
    }) ||
    isSimilarDocumentPair(documentText, getExampleDocumentText())
  );
};

const isBlankOrInProgressCommand = (text: string): boolean => {
  const textWithoutWhitespace = removeWhitespace(text);
  return textWithoutWhitespace === '' || /^\/[a-z]*$/i.test(textWithoutWhitespace);
};

const isSimilarDocumentPair = (
  documentText: StoredDocumentText,
  referenceText: StoredDocumentText,
): boolean => {
  return (
    getTextSimilarity(documentText.draftText, referenceText.draftText) >=
      EXAMPLE_COMMAND_SIMILARITY_THRESHOLD &&
    getTextSimilarity(documentText.editorText, referenceText.editorText) >=
      EXAMPLE_COMMAND_SIMILARITY_THRESHOLD
  );
};

const getTextSimilarity = (leftText: string, rightText: string): number => {
  const left = removeWhitespace(leftText);
  const right = removeWhitespace(rightText);

  if (left === right) {
    return 1;
  }

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const previousDistances = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonalDistance = previousDistances[0];
    previousDistances[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const upperDistance = previousDistances[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      previousDistances[rightIndex] = Math.min(
        previousDistances[rightIndex] + 1,
        previousDistances[rightIndex - 1] + 1,
        diagonalDistance + substitutionCost,
      );
      diagonalDistance = upperDistance;
    }
  }

  const editDistance = previousDistances[right.length];
  return 1 - editDistance / Math.max(left.length, right.length);
};

const removeWhitespace = (text: string): string => text.replace(/\s/g, '');
