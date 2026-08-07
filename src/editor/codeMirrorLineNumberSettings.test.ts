import { describe, expect, it } from 'vitest';

import {
  LINE_NUMBER_AUTO_HIDE_DELAY_MS,
  LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME,
  getCodeMirrorPaneLineNumberClassName,
  getLineNumberEdgeTriggerClassName,
} from './codeMirrorLineNumberSettings';

describe('getCodeMirrorPaneLineNumberClassName', () => {
  it('returns left visible classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'left',
        visibilityMode: 'visible',
        isVisible: true,
      }),
    ).toBe('diff-line-numbers-left diff-line-numbers-visible-mode diff-line-numbers-visible');
  });

  it('returns right visible classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'right',
        visibilityMode: 'visible',
        isVisible: true,
      }),
    ).toBe('diff-line-numbers-right diff-line-numbers-visible-mode diff-line-numbers-visible');
  });

  it('returns autoHide hidden classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'left',
        visibilityMode: 'autoHide',
        isVisible: false,
      }),
    ).toBe('diff-line-numbers-left diff-line-numbers-auto-hide diff-line-numbers-hidden');
  });

  it('returns autoHide visible classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'right',
        visibilityMode: 'autoHide',
        isVisible: true,
      }),
    ).toBe('diff-line-numbers-right diff-line-numbers-auto-hide diff-line-numbers-visible');
  });
});

describe('getLineNumberEdgeTriggerClassName', () => {
  it('uses the expected edge trigger width class', () => {
    expect(LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME).toBe(
      'w-[var(--diff-line-number-gutter-width)]',
    );
  });

  it('returns left edge trigger class', () => {
    expect(getLineNumberEdgeTriggerClassName({ position: 'left' })).toBe(
      'absolute inset-y-0 left-0 z-50 w-[var(--diff-line-number-gutter-width)] diff-mouse-reveal-edge-trigger',
    );
  });

  it('returns right edge trigger class', () => {
    expect(getLineNumberEdgeTriggerClassName({ position: 'right' })).toBe(
      'absolute inset-y-0 right-0 z-50 w-[var(--diff-line-number-gutter-width)] diff-mouse-reveal-edge-trigger',
    );
  });
});

describe('LINE_NUMBER_AUTO_HIDE_DELAY_MS', () => {
  it('is 2000', () => {
    expect(LINE_NUMBER_AUTO_HIDE_DELAY_MS).toBe(2000);
  });
});
