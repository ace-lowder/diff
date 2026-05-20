import { describe, expect, it } from 'vitest';

import { getMissingLineWidgetAnchor } from './missingLineAnchors';

describe('getMissingLineWidgetAnchor', () => {
  const docText = 'one\ntwo\nthree';

  it('anchors before line 1 at start of document', () => {
    expect(
      getMissingLineWidgetAnchor({
        docText,
        lineNumber: 1,
        placement: 'before',
      }),
    ).toEqual({ position: 0, side: -1 });
  });

  it('anchors before line 2 after line 1 end', () => {
    expect(
      getMissingLineWidgetAnchor({
        docText,
        lineNumber: 2,
        placement: 'before',
      }),
    ).toEqual({ position: 3, side: 1 });
  });

  it('anchors before line 3 after line 2 end', () => {
    expect(
      getMissingLineWidgetAnchor({
        docText,
        lineNumber: 3,
        placement: 'before',
      }),
    ).toEqual({ position: 7, side: 1 });
  });

  it('anchors after line 3 at line 3 end', () => {
    expect(
      getMissingLineWidgetAnchor({
        docText,
        lineNumber: 3,
        placement: 'after',
      }),
    ).toEqual({ position: 13, side: 1 });
  });
});
