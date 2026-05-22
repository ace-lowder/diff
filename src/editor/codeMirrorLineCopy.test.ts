import { describe, expect, it } from 'vitest';

import {
  LINE_NUMBER_COPY_CHECK_MARK,
  getLineNumberLabel,
} from './codeMirrorLineCopy';

describe('getLineNumberLabel', () => {
  it('returns the line number when there is no copied line', () => {
    expect(getLineNumberLabel({ lineNumber: 3, copiedLineNumber: null })).toBe('3');
  });

  it('returns the line number when a different line was copied', () => {
    expect(getLineNumberLabel({ lineNumber: 3, copiedLineNumber: 2 })).toBe('3');
  });

  it('returns checkmark when the line was copied', () => {
    expect(getLineNumberLabel({ lineNumber: 3, copiedLineNumber: 3 })).toBe('✓');
  });
});

describe('LINE_NUMBER_COPY_CHECK_MARK', () => {
  it('is a checkmark', () => {
    expect(LINE_NUMBER_COPY_CHECK_MARK).toBe('✓');
  });
});
