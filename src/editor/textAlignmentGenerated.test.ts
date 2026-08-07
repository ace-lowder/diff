import { describe, expect, it } from 'vitest';

import type { TextRange } from '../editorDiff';
import {
  expectLinkedAt,
  getVerifiedComparison,
} from './textAlignmentTestAssertions';

type GeneratedCase = {
  name: string;
  paragraphCount: number;
  insertEvery: number;
  deleteEvery: number;
  reviseEvery: number;
  splitEvery: number;
};

type ExpectedLink = {
  draftLine: string;
  editorLine: string;
  unchanged: boolean;
};

const GENERATED_CASES: GeneratedCase[] = [
  {
    name: 'short draft with frequent mixed edits',
    paragraphCount: 8,
    insertEvery: 4,
    deleteEvery: 8,
    reviseEvery: 3,
    splitEvery: 5,
  },
  {
    name: 'longer short draft with overlapping edits',
    paragraphCount: 18,
    insertEvery: 5,
    deleteEvery: 7,
    reviseEvery: 4,
    splitEvery: 6,
  },
  {
    name: 'medium draft with 48 source paragraphs',
    paragraphCount: 48,
    insertEvery: 4,
    deleteEvery: 11,
    reviseEvery: 7,
    splitEvery: 13,
  },
  {
    name: 'medium draft with 120 source paragraphs',
    paragraphCount: 120,
    insertEvery: 6,
    deleteEvery: 17,
    reviseEvery: 9,
    splitEvery: 14,
  },
];

const SUBJECTS = [
  'The project team',
  'A field researcher',
  'The design group',
  'An independent reviewer',
  'The support crew',
];

const ACTIONS = [
  'reviewed evidence',
  'mapped customer feedback',
  'tested the release flow',
  'documented edge cases',
  'compared source records',
  'checked accessibility notes',
  'measured response times',
];

const OUTCOMES = [
  'publishing the final report',
  'sharing the approved proposal',
  'releasing the updated interface',
  'presenting the verified findings',
];

const createSourceParagraph = (index: number) => {
  const marker = String(index).padStart(3, '0');
  const subject = SUBJECTS[index % SUBJECTS.length];
  const action = ACTIONS[index % ACTIONS.length];
  const outcome = OUTCOMES[index % OUTCOMES.length];
  return `Section ${marker}: ${subject} ${action} for marker ${marker} before ${outcome}.`;
};

const createInsertedParagraph = (index: number) => {
  return `New note ${index}: reviewers added symbols ✓, #${index}, and follow-up context.`;
};

const reviseParagraph = (paragraph: string) => {
  return paragraph.replace(' before ', ' with updated context before ');
};

const splitParagraph = (paragraph: string) => {
  return paragraph.replace(' before ', '\nbefore ');
};

const createGeneratedTexts = (testCase: GeneratedCase) => {
  const draftLines = Array.from({ length: testCase.paragraphCount }, (_, index) =>
    createSourceParagraph(index + 1),
  );
  const editorLines: string[] = [];
  const expectedLinks: ExpectedLink[] = [];

  draftLines.forEach((draftLine, offset) => {
    const index = offset + 1;
    if (index % testCase.deleteEvery === 0) {
      return;
    }

    const revised = index % testCase.reviseEvery === 0;
    const split = index % testCase.splitEvery === 0;
    let editorLine = revised ? reviseParagraph(draftLine) : draftLine;
    editorLine = split ? splitParagraph(editorLine) : editorLine;

    editorLines.push(editorLine);
    expectedLinks.push({
      draftLine,
      editorLine,
      unchanged: !revised && !split,
    });

    if (index % testCase.insertEvery === 0) {
      editorLines.push(createInsertedParagraph(index));
    }
  });

  return {
    draftText: draftLines.join('\n'),
    editorText: editorLines.join('\n'),
    expectedLinks,
  };
};

const expectNoVisibleHighlight = (
  ranges: TextRange[],
  from: number,
  to: number,
) => {
  const overlappingRanges = ranges.filter(
    (range) => range.to > range.from && range.from < to && range.to > from,
  );
  expect(overlappingRanges).toEqual([]);
};

describe('generated text alignment', () => {
  it.each(GENERATED_CASES)('preserves known links in a $name', (testCase) => {
    const { draftText, editorText, expectedLinks } = createGeneratedTexts(testCase);
    const comparison = getVerifiedComparison(draftText, editorText);

    expectedLinks.forEach(({ draftLine, editorLine, unchanged }) => {
      const draftFrom = draftText.indexOf(draftLine);
      const editorFrom = editorText.indexOf(editorLine);

      expect(draftFrom).toBeGreaterThanOrEqual(0);
      expect(editorFrom).toBeGreaterThanOrEqual(0);
      expectLinkedAt(comparison.alignment, draftFrom, editorFrom, draftLine);

      if (unchanged) {
        expectNoVisibleHighlight(
          comparison.draftHighlightRanges,
          draftFrom,
          draftFrom + draftLine.length,
        );
        expectNoVisibleHighlight(
          comparison.editorHighlightRanges,
          editorFrom,
          editorFrom + editorLine.length,
        );
      }
    });

    expect(comparison.editorStats.addedWordCount).toBeGreaterThan(0);
    expect(comparison.editorStats.deletedWordCount).toBeGreaterThan(0);
  });
});
