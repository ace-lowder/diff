import { describe, expect, it } from 'vitest';

import {
  getActiveFontStyleTypesForSelections,
  getInsertedFontStyleRanges,
  mapFontStyleRangesThroughChanges,
  normalizeFontStyleRanges,
  toggleFontStyleRanges,
  type FontStyleRange,
} from './fontStyles';

describe('normalizeFontStyleRanges', () => {
  it('merges adjacent same-type ranges', () => {
    const ranges = normalizeFontStyleRanges([
      { type: 'bold', from: 0, to: 2 },
      { type: 'bold', from: 2, to: 4 },
      { type: 'italic', from: 1, to: 3 },
    ]);

    expect(ranges).toEqual([
      { type: 'bold', from: 0, to: 4 },
      { type: 'italic', from: 1, to: 3 },
    ]);
  });
});

describe('toggleFontStyleRanges', () => {
  it('adds bold for an unstyled selection', () => {
    const ranges = toggleFontStyleRanges({
      ranges: [],
      type: 'bold',
      selections: [{ from: 1, to: 4 }],
    });

    expect(ranges).toEqual([{ type: 'bold', from: 1, to: 4 }]);
  });

  it('removes bold from fully styled selection', () => {
    const ranges = toggleFontStyleRanges({
      ranges: [{ type: 'bold', from: 1, to: 4 }],
      type: 'bold',
      selections: [{ from: 1, to: 4 }],
    });

    expect(ranges).toEqual([]);
  });

  it('splits a bold range when removing from the middle', () => {
    const ranges = toggleFontStyleRanges({
      ranges: [{ type: 'bold', from: 0, to: 10 }],
      type: 'bold',
      selections: [{ from: 3, to: 7 }],
    });

    expect(ranges).toEqual([
      { type: 'bold', from: 0, to: 3 },
      { type: 'bold', from: 7, to: 10 },
    ]);
  });
});

describe('mapFontStyleRangesThroughChanges', () => {
  it('maps ranges after inserting text before a range', () => {
    const ranges = mapFontStyleRangesThroughChanges({
      ranges: [{ type: 'bold', from: 5, to: 8 }],
      changes: [{ fromA: 2, toA: 2, fromB: 2, toB: 4 }],
    });

    expect(ranges).toEqual([{ type: 'bold', from: 7, to: 10 }]);
  });

  it('maps ranges after deleting text before and inside a range', () => {
    const ranges = mapFontStyleRangesThroughChanges({
      ranges: [{ type: 'bold', from: 5, to: 10 }],
      changes: [
        { fromA: 2, toA: 4, fromB: 2, toB: 2 },
        { fromA: 6, toA: 8, fromB: 6, toB: 6 },
      ],
    });

    expect(ranges).toEqual([{ type: 'bold', from: 3, to: 6 }]);
  });
});

describe('getInsertedFontStyleRanges', () => {
  it('creates inserted ranges for each active style type', () => {
    const ranges = getInsertedFontStyleRanges({
      changes: [
        { fromA: 1, toA: 1, fromB: 1, toB: 4 },
        { fromA: 5, toA: 7, fromB: 5, toB: 5 },
      ],
      activeTypes: ['bold', 'italic', 'underline'],
    });

    expect(ranges).toEqual([
      { type: 'bold', from: 1, to: 4 },
      { type: 'italic', from: 1, to: 4 },
      { type: 'underline', from: 1, to: 4 },
    ] satisfies FontStyleRange[]);
  });
});

describe('getActiveFontStyleTypesForSelections', () => {
  it('returns fallback active types in bold italic underline order when there is no selection', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [],
      selections: [],
      fallbackActiveTypes: ['underline', 'bold'],
    });

    expect(activeTypes).toEqual(['bold', 'underline']);
  });

  it('returns bold for a fully bold-covered selection', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [{ type: 'bold', from: 2, to: 6 }],
      selections: [{ from: 2, to: 6 }],
      fallbackActiveTypes: [],
    });

    expect(activeTypes).toEqual(['bold']);
  });

  it('treats adjacent bold ranges as fully covering a selection', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [
        { type: 'bold', from: 2, to: 4 },
        { type: 'bold', from: 4, to: 6 },
      ],
      selections: [{ from: 2, to: 6 }],
      fallbackActiveTypes: [],
    });

    expect(activeTypes).toEqual(['bold']);
  });

  it('does not treat partial bold coverage as active', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [{ type: 'bold', from: 2, to: 5 }],
      selections: [{ from: 2, to: 6 }],
      fallbackActiveTypes: [],
    });

    expect(activeTypes).toEqual([]);
  });

  it('requires every selection to be fully covered for a style to be active', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [{ type: 'bold', from: 2, to: 6 }],
      selections: [
        { from: 2, to: 6 },
        { from: 8, to: 10 },
      ],
      fallbackActiveTypes: [],
    });

    expect(activeTypes).toEqual([]);
  });

  it('evaluates each style independently', () => {
    const activeTypes = getActiveFontStyleTypesForSelections({
      ranges: [
        { type: 'bold', from: 2, to: 6 },
        { type: 'italic', from: 2, to: 4 },
      ],
      selections: [{ from: 2, to: 6 }],
      fallbackActiveTypes: [],
    });

    expect(activeTypes).toEqual(['bold']);
  });
});
