import { describe, expect, it } from 'vitest';

import {
  LEFT_LINE_NUMBER_TEXT_OFFSET,
  RIGHT_LINE_NUMBER_TEXT_OFFSET,
} from './codeMirrorExtensions';

describe('line number text offsets', () => {
  it('uses tuned left and right line number text offsets', () => {
    expect(LEFT_LINE_NUMBER_TEXT_OFFSET).toBe('0.5ch');
    expect(RIGHT_LINE_NUMBER_TEXT_OFFSET).toBe('0.75ch');
  });
});
