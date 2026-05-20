import { describe, expect, it } from 'vitest';

import { getMarkerRange } from './markerRanges';

describe('getMarkerRange', () => {
  it('returns left marker for a middle position', () => {
    expect(getMarkerRange({ text: 'onetwo', position: 3 })).toEqual({
      from: 3,
      to: 4,
      side: 'left',
    });
  });

  it('returns right marker at end of line', () => {
    expect(getMarkerRange({ text: 'onetwo', position: 6 })).toEqual({
      from: 5,
      to: 6,
      side: 'right',
    });
  });

  it('never wraps newline characters', () => {
    const marker = getMarkerRange({ text: 'one\ntwo', position: 3 });
    expect(marker).not.toBeNull();
    if (!marker) {
      return;
    }

    expect(marker).toSatisfy((value) => {
      return (
        (value.side === 'right' && value.from === 2 && value.to === 3) ||
        (value.side === 'left' && value.from === 4 && value.to === 5)
      );
    });
  });

  it('returns null for empty text', () => {
    expect(getMarkerRange({ text: '', position: 0 })).toBeNull();
  });

  it('returns null on an empty line', () => {
    expect(getMarkerRange({ text: 'one\n\ntwo', position: 4 })).toBeNull();
  });
});
