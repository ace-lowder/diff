import { describe, expect, it } from 'vitest';

import type { TextAlignment } from '../editorDiff';
import { getVerifiedComparison } from './textAlignmentTestAssertions';

const getLinkedLineOffsets = (alignment: TextAlignment) => {
  return alignment.parts.flatMap((part) =>
    part.type === 'linked'
      ? [
          {
            draftFrom: part.draftRange.from,
            editorFrom: part.editorRange.from,
          },
        ]
      : [],
  );
};

const getLineStart = (text: string, line: string, from = 0) => {
  const start = text.indexOf(line, from);
  expect(start).toBeGreaterThanOrEqual(0);
  return start;
};

const expectLinkedAt = (
  alignment: TextAlignment,
  draftFrom: number,
  editorFrom: number,
) => {
  expect(getLinkedLineOffsets(alignment)).toContainEqual({
    draftFrom,
    editorFrom,
  });
};

describe('text alignment resilience', () => {
  it('keeps repeated paragraphs linked to their ordered occurrences', () => {
    const repeated = 'Reviewers approved the detailed release notes.';
    const revised = 'Reviewers approved the revised detailed release notes.';
    const draftText = [repeated, 'A unique bridge paragraph.', repeated].join('\n');
    const editorText = [repeated, 'A unique bridge paragraph.', revised].join('\n');
    const comparison = getVerifiedComparison(draftText, editorText);
    const secondDraftStart = getLineStart(draftText, repeated, repeated.length);

    expectLinkedAt(comparison.alignment, 0, 0);
    expectLinkedAt(
      comparison.alignment,
      secondDraftStart,
      getLineStart(editorText, revised),
    );
  });

  it('prefers a later exact paragraph over an earlier lookalike', () => {
    const original = 'The field team verified every item before release.';
    const lookalike = 'The field team reviewed every item before release.';
    const draftText = ['Opening anchor.', original, 'Closing anchor.'].join('\n');
    const editorText = [
      'Opening anchor.',
      lookalike,
      'Inserted context.',
      original,
      'Closing anchor.',
    ].join('\n');
    const comparison = getVerifiedComparison(draftText, editorText);

    expectLinkedAt(
      comparison.alignment,
      getLineStart(draftText, original),
      getLineStart(editorText, original),
    );
  });

  it('keeps later paragraphs linked across a large insertion', () => {
    const revisedDraft = 'The final reviewer checked the original source list.';
    const revisedEditor = 'The final reviewer carefully checked the original source list.';
    const exact = 'The report ended with verified findings.';
    const insertedLines = Array.from(
      { length: 30 },
      (_, index) => `New supporting paragraph ${index + 1} covers separate evidence.`,
    );
    const draftText = ['Opening anchor.', revisedDraft, exact, 'Closing anchor.'].join(
      '\n',
    );
    const editorText = [
      'Opening anchor.',
      ...insertedLines,
      revisedEditor,
      exact,
      'Closing anchor.',
    ].join('\n');
    const comparison = getVerifiedComparison(draftText, editorText);

    expectLinkedAt(
      comparison.alignment,
      getLineStart(draftText, revisedDraft),
      getLineStart(editorText, revisedEditor),
    );
    expectLinkedAt(
      comparison.alignment,
      getLineStart(draftText, exact),
      getLineStart(editorText, exact),
    );
  });

  it('prefers the strongest revision after a distant lookalike', () => {
    const original =
      'Mountain rescue teams followed the original route through the storm.';
    const lookalike =
      'Mountain rescue teams followed a different route through the valley.';
    const revision =
      'Mountain rescue teams carefully followed the original route through the storm.';
    const insertedLines = Array.from(
      { length: 20 },
      (_, index) => `Unrelated field note ${index + 1} records separate observations.`,
    );
    const draftText = [
      'Opening anchor.',
      original,
      'The report ended with verified findings.',
      'Closing anchor.',
    ].join('\n');
    const editorText = [
      'Opening anchor.',
      lookalike,
      ...insertedLines,
      revision,
      'The report ended with verified findings.',
      'Closing anchor.',
    ].join('\n');
    const comparison = getVerifiedComparison(draftText, editorText);

    expectLinkedAt(
      comparison.alignment,
      getLineStart(draftText, original),
      getLineStart(editorText, revision),
    );
  });
});
