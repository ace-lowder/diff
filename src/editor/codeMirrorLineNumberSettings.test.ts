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
    ).toBe('byline-line-numbers-left byline-line-numbers-visible-mode byline-line-numbers-visible');
  });

  it('returns right visible classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'right',
        visibilityMode: 'visible',
        isVisible: true,
      }),
    ).toBe('byline-line-numbers-right byline-line-numbers-visible-mode byline-line-numbers-visible');
  });

  it('returns autoHide hidden classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'left',
        visibilityMode: 'autoHide',
        isVisible: false,
      }),
    ).toBe('byline-line-numbers-left byline-line-numbers-auto-hide byline-line-numbers-hidden');
  });

  it('returns autoHide visible classes', () => {
    expect(
      getCodeMirrorPaneLineNumberClassName({
        position: 'right',
        visibilityMode: 'autoHide',
        isVisible: true,
      }),
    ).toBe('byline-line-numbers-right byline-line-numbers-auto-hide byline-line-numbers-visible');
  });
});

describe('getLineNumberEdgeTriggerClassName', () => {
  it('uses the expected edge trigger width class', () => {
    expect(LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME).toBe('w-[calc(6ch+12px)]');
  });

  it('returns left edge trigger class', () => {
    expect(getLineNumberEdgeTriggerClassName({ position: 'left' })).toBe(
      'absolute inset-y-0 left-0 z-50 w-[calc(6ch+12px)]',
    );
  });

  it('returns right edge trigger class', () => {
    expect(getLineNumberEdgeTriggerClassName({ position: 'right' })).toBe(
      'absolute inset-y-0 right-0 z-50 w-[calc(6ch+12px)]',
    );
  });
});

describe('LINE_NUMBER_AUTO_HIDE_DELAY_MS', () => {
  it('is 2000', () => {
    expect(LINE_NUMBER_AUTO_HIDE_DELAY_MS).toBe(2000);
  });
});
