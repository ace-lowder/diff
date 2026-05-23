import { describe, expect, it } from 'vitest';

import {
  LEFT_LINE_NUMBER_TEXT_NUDGE,
  RIGHT_LINE_NUMBER_TEXT_NUDGE,
} from '../layoutTuning';

describe('line number text offsets', () => {
  it('uses tuned left and right line number text offsets', () => {
    expect(LEFT_LINE_NUMBER_TEXT_NUDGE).toBe('0ch');
    expect(RIGHT_LINE_NUMBER_TEXT_NUDGE).toBe('-0.75ch');
  });
});
