import { describe, expect, it } from 'vitest';

import { getWordCount } from '../editorDiff';
import {
  expectLinkedPositions,
  getVerifiedComparison,
} from './textAlignmentTestAssertions';

const PARAGRAPH_COUNT = 200;
const WORDS_PER_PARAGRAPH = 50;
const MAX_COMPARISON_TIME_MS = 15_000;

const createToken = (
  kind: 'source' | 'replacement',
  paragraphIndex: number,
  wordIndex: number,
) => {
  const symbol = wordIndex % 17 === 0 ? '✓' : wordIndex % 23 === 0 ? '#' : '';
  return `${kind}${symbol}-${String(paragraphIndex).padStart(3, '0')}-${String(wordIndex).padStart(2, '0')}`;
};

const createParagraphTokens = (
  kind: 'source' | 'replacement',
  paragraphIndex: number,
) => {
  return Array.from({ length: WORDS_PER_PARAGRAPH }, (_, wordIndex) =>
    createToken(kind, paragraphIndex, wordIndex + 1),
  );
};

const addControlledLineBreaks = (paragraph: string, paragraphIndex: number) => {
  if (paragraphIndex % 10 !== 0) {
    return paragraph;
  }

  const words = paragraph.split(' ');
  return [words.slice(0, 15), words.slice(15, 35), words.slice(35)]
    .map((line) => line.join(' '))
    .join('\n');
};

const createScaleComparison = () => {
  const draftParagraphs: string[] = [];
  const editorParagraphs: string[] = [];
  const survivingTokenGroups: string[][] = [];

  for (let paragraphIndex = 1; paragraphIndex <= PARAGRAPH_COUNT; paragraphIndex += 1) {
    const sourceTokens = createParagraphTokens('source', paragraphIndex);
    const draftParagraph = sourceTokens.join(' ');
    const survives = paragraphIndex % 2 === 0;
    const editorParagraph = survives
      ? addControlledLineBreaks(draftParagraph, paragraphIndex)
      : createParagraphTokens('replacement', paragraphIndex).join(' ');

    draftParagraphs.push(draftParagraph);
    editorParagraphs.push(editorParagraph);
    if (survives) {
      survivingTokenGroups.push(sourceTokens);
    }
  }

  const draftText = draftParagraphs.join('\n');
  const editorText = editorParagraphs.join('\n');
  const expectedPositions = survivingTokenGroups.flatMap((tokens) =>
    tokens.map((token) => ({
      draftFrom: draftText.indexOf(token),
      editorFrom: editorText.indexOf(token),
    })),
  );

  return { draftText, editorText, expectedPositions };
};

describe('large text alignment', () => {
  it(
    'keeps 5,000 surviving words linked in a 10,000-word rewrite',
    { timeout: 30_000 },
    () => {
      const { draftText, editorText, expectedPositions } = createScaleComparison();

      expect(getWordCount(draftText)).toBe(10_000);
      expect(getWordCount(editorText)).toBe(10_000);
      expect(expectedPositions).toHaveLength(5_000);
      expect(expectedPositions.every(({ draftFrom, editorFrom }) =>
        draftFrom >= 0 && editorFrom >= 0,
      )).toBe(true);

      const startedAt = performance.now();
      const comparison = getVerifiedComparison(draftText, editorText);
      const comparisonTime = performance.now() - startedAt;

      expectLinkedPositions(comparison.alignment, expectedPositions);
      expect(comparison.editorStats.addedWordCount).toBe(5_000);
      expect(comparison.editorStats.deletedWordCount).toBe(5_000);
      expect(comparisonTime).toBeLessThan(MAX_COMPARISON_TIME_MS);
    },
  );
});
