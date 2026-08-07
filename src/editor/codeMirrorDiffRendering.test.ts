import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { getLineAnchoredDiffResult } from '../editorDiff';
import {
  getDiffPaintTargets,
  getLineBoundedRangeSegments,
  getVisibleDiffPaintTargets,
  getVisualRowRangeSegments,
  type DiffPaintState,
} from './codeMirrorDiffPaint';

const getEditorPaintState = (
  result: ReturnType<typeof getLineAnchoredDiffResult>,
): DiffPaintState => {
  return {
    editorHighlightRanges: result.editorHighlightRanges,
    draftHighlightRanges: result.draftHighlightRanges,
    editorLineDecorations: result.lineDecorations.editorLineDecorations,
    draftLineDecorations: result.lineDecorations.draftLineDecorations,
    lowestEditedLine: result.lowestEditedLine,
    isTyping: false,
  };
};

describe('CodeMirror diff rendering', () => {
  it('keeps inserted highlights aligned across wrapped visual rows', () => {
    const draftText = [
      'Opening paragraph.',
      'Reviewers approved the final report.',
      'Closing paragraph.',
    ].join('\n');
    const editorText = [
      'Opening paragraph.',
      'Reviewers approved the carefully expanded evidence summary with several verified examples and notes final report.',
      'Closing paragraph.',
    ].join('\n');
    const result = getLineAnchoredDiffResult({ draftText, editorText });
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: editorText,
      docLineCount: 3,
      activeLineNumber: 2,
      diffPaint: getEditorPaintState(result),
    });
    const rangeTargets = targets.filter((target) => target.type === 'range');
    const lineStart = editorText.indexOf('Reviewers');
    const wrapWidth = 12;
    const lineHeight = 24;
    const visualSegments = rangeTargets.flatMap((target) =>
      getLineBoundedRangeSegments({
        text: editorText,
        from: target.from,
        to: target.to,
      }).flatMap((lineSegment) =>
        getVisualRowRangeSegments({
          ...lineSegment,
          lineHeight,
          getPositionTop(position, side) {
            const effectivePosition =
              side === -1 ? Math.max(lineStart, position - 1) : position;
            return Math.floor((effectivePosition - lineStart) / wrapWidth) * lineHeight;
          },
        }),
      ),
    );

    expect(
      rangeTargets.map((target) => editorText.slice(target.from, target.to)).join(''),
    ).toContain('carefully expanded evidence summary');
    expect(visualSegments.length).toBeGreaterThan(rangeTargets.length);
    expect(
      visualSegments.map((segment) => editorText.slice(segment.from, segment.to)).join(''),
    ).toBe(
      rangeTargets.map((target) => editorText.slice(target.from, target.to)).join(''),
    );
    expect(
      visualSegments.every((segment) => {
        const firstRow = Math.floor((segment.from - lineStart) / wrapWidth);
        const lastRow = Math.floor((segment.to - 1 - lineStart) / wrapWidth);
        return firstRow === lastRow;
      }),
    ).toBe(true);
  });

  it('keeps a lower highlight available after scrolling through a long draft', () => {
    const draftLines = Array.from(
      { length: 80 },
      (_, index) =>
        `Paragraph ${String(index + 1).padStart(3, '0')} records stable context for the comparison view and its viewport.`,
    );
    const editorLines = [...draftLines];
    editorLines[69] = editorLines[69].replace(
      'stable context',
      'carefully revised context',
    );
    const draftText = draftLines.join('\n');
    const editorText = editorLines.join('\n');
    const editorState = EditorState.create({ doc: editorText });
    const result = getLineAnchoredDiffResult({ draftText, editorText });
    const targets = getDiffPaintTargets({
      theme: 'editor',
      text: editorText,
      docLineCount: editorState.doc.lines,
      activeLineNumber: 1,
      diffPaint: getEditorPaintState(result),
    });
    const visibleTargets = getVisibleDiffPaintTargets({
      targets,
      visibleRanges: [
        {
          from: editorState.doc.line(68).from,
          to: editorState.doc.line(72).to,
        },
      ],
      docLineCount: editorState.doc.lines,
      getLineRange(lineNumber) {
        const line = editorState.doc.line(lineNumber);
        return { from: line.from, to: line.to };
      },
    });

    expect(
      visibleTargets
        .filter((target) => target.type === 'range')
        .map((target) => editorText.slice(target.from, target.to)),
    ).toContain('carefully revised');
    expect(
      visibleTargets.some(
        (target) => target.type === 'line' && target.lineNumber === 1,
      ),
    ).toBe(false);
  });
});
