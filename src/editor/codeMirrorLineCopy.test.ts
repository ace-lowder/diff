import { describe, expect, it } from 'vitest';

import {
  getVisibleLineNumberGutterWidthPx,
  LINE_COPY_ICON_CLASS_NAME,
  LINE_COPY_ICON_FADE_MS,
  LINE_COPY_ICON_FADING_CLASS_NAME,
  LINE_COPY_ICON_REMOVE_MS,
  LINE_COPY_ICON_VISIBLE_MS,
  getLineNumberGutterClassName,
  getLineNumberGutterSide,
  getLineNumberElement,
  getLineCopyIconMarkup,
  shouldShowLineNumberGutter,
} from './codeMirrorLineCopy';

class MockElement {
  readonly classList: { contains: (className: string) => boolean };
  private readonly closestMatch: MockElement | null;

  constructor({
    classNames = [],
    closestMatch = null,
  }: {
    classNames?: string[];
    closestMatch?: MockElement | null;
  } = {}) {
    const classNameSet = new Set(classNames);
    this.classList = {
      contains: (className: string) => classNameSet.has(className),
    };
    this.closestMatch = closestMatch;
  }

  closest(selector: string): MockElement | null {
    void selector;
    return this.closestMatch;
  }
}

describe('line copy icon constants', () => {
  it('uses a 500ms icon visible duration', () => {
    expect(LINE_COPY_ICON_VISIBLE_MS).toBe(500);
  });

  it('uses a 500ms icon fade duration', () => {
    expect(LINE_COPY_ICON_FADE_MS).toBe(500);
  });

  it('uses a 1000ms icon remove duration', () => {
    expect(LINE_COPY_ICON_REMOVE_MS).toBe(1000);
  });

  it('uses expected icon class names', () => {
    expect(LINE_COPY_ICON_CLASS_NAME).toBe('diff-line-copy-icon');
    expect(LINE_COPY_ICON_FADING_CLASS_NAME).toBe('diff-line-copy-icon-fading');
  });
});

describe('getLineCopyIconMarkup', () => {
  it('contains the copy icon rectangle and path', () => {
    const markup = getLineCopyIconMarkup();

    expect(markup).toContain('<rect x="9" y="9" width="13" height="13"');
    expect(markup).toContain('<path d="M5 15H4');
    expect(markup).not.toContain('m5 13 4 4L19 7');
  });
});

describe('line number gutter visibility and side helpers', () => {
  it('shows gutter when visibility mode is visible', () => {
    expect(
      shouldShowLineNumberGutter({
        visibilityMode: 'visible',
        isVisible: false,
      }),
    ).toBe(true);
  });

  it('shows gutter when autoHide mode is currently visible', () => {
    expect(
      shouldShowLineNumberGutter({
        visibilityMode: 'autoHide',
        isVisible: true,
      }),
    ).toBe(true);
  });

  it('hides gutter when autoHide mode is currently hidden', () => {
    expect(
      shouldShowLineNumberGutter({
        visibilityMode: 'autoHide',
        isVisible: false,
      }),
    ).toBe(false);
  });

  it('maps left position to before side', () => {
    expect(getLineNumberGutterSide('left')).toBe('before');
  });

  it('maps right position to after side', () => {
    expect(getLineNumberGutterSide('right')).toBe('after');
  });

  it('builds the left gutter class name', () => {
    expect(getLineNumberGutterClassName('left')).toBe(
      'cm-lineNumbers diff-line-number-gutter diff-line-number-gutter-left',
    );
  });

  it('builds the right gutter class name', () => {
    expect(getLineNumberGutterClassName('right')).toBe(
      'cm-lineNumbers diff-line-number-gutter diff-line-number-gutter-right',
    );
  });
});

describe('getVisibleLineNumberGutterWidthPx', () => {
  const getView = ({
    settings,
    width,
    hasGutter = true,
  }: {
    settings: { visibilityMode: 'visible' | 'autoHide'; isVisible: boolean } | null;
    width?: number;
    hasGutter?: boolean;
  }) => {
    return {
      state: {
        field: () => settings,
      },
      dom: {
        querySelector: () => {
          if (!hasGutter) {
            return null;
          }

          return {
            getBoundingClientRect: () => ({ width }),
          };
        },
      },
    };
  };

  it('returns 0 when settings are missing', () => {
    const view = getView({ settings: null, width: 40 });

    expect(getVisibleLineNumberGutterWidthPx(view as never)).toBe(0);
  });

  it('returns 0 when line numbers are hidden', () => {
    const view = getView({
      settings: { visibilityMode: 'autoHide', isVisible: false },
      width: 40,
    });

    expect(getVisibleLineNumberGutterWidthPx(view as never)).toBe(0);
  });

  it('returns 0 when line number gutter element is missing', () => {
    const view = getView({
      settings: { visibilityMode: 'visible', isVisible: true },
      hasGutter: false,
    });

    expect(getVisibleLineNumberGutterWidthPx(view as never)).toBe(0);
  });

  it('returns measured width when line numbers are visible', () => {
    const view = getView({
      settings: { visibilityMode: 'visible', isVisible: true },
      width: 47.5,
    });

    expect(getVisibleLineNumberGutterWidthPx(view as never)).toBe(47.5);
  });

  it('returns 0 for non-finite or non-positive widths', () => {
    const notFiniteView = getView({
      settings: { visibilityMode: 'visible', isVisible: true },
      width: Number.NaN,
    });
    const negativeView = getView({
      settings: { visibilityMode: 'visible', isVisible: true },
      width: -4,
    });

    expect(getVisibleLineNumberGutterWidthPx(notFiniteView as never)).toBe(0);
    expect(getVisibleLineNumberGutterWidthPx(negativeView as never)).toBe(0);
  });
});

describe('getLineNumberElement', () => {
  it('returns closest gutter row from event target', () => {
    const originalHTMLElement = globalThis.HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).HTMLElement = MockElement as any;

    const row = new MockElement({ classNames: ['cm-gutterElement'] });
    const child = new MockElement({ closestMatch: row });
    const event = {
      target: child,
      currentTarget: new MockElement(),
    } as unknown as Event;

    expect(getLineNumberElement(event)).toBe(row as unknown as HTMLElement);

    globalThis.HTMLElement = originalHTMLElement;
  });

  it('prefers target gutter row over non-row currentTarget', () => {
    const originalHTMLElement = globalThis.HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).HTMLElement = MockElement as any;

    const row = new MockElement({ classNames: ['cm-gutterElement'] });
    const child = new MockElement({ closestMatch: row });
    const gutterColumn = new MockElement({ classNames: ['cm-gutter', 'cm-lineNumbers'] });
    const event = {
      target: child,
      currentTarget: gutterColumn,
    } as unknown as Event;

    expect(getLineNumberElement(event)).toBe(row as unknown as HTMLElement);

    globalThis.HTMLElement = originalHTMLElement;
  });

  it('returns currentTarget when it is a gutter row and target lookup fails', () => {
    const originalHTMLElement = globalThis.HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).HTMLElement = MockElement as any;

    const row = new MockElement({ classNames: ['cm-gutterElement'] });
    const targetWithoutMatch = new MockElement({ closestMatch: null });
    const event = {
      target: targetWithoutMatch,
      currentTarget: row,
    } as unknown as Event;

    expect(getLineNumberElement(event)).toBe(row as unknown as HTMLElement);

    globalThis.HTMLElement = originalHTMLElement;
  });

  it('returns null when target and currentTarget are not gutter rows', () => {
    const originalHTMLElement = globalThis.HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).HTMLElement = MockElement as any;

    const event = {
      target: new MockElement({ closestMatch: null }),
      currentTarget: new MockElement({ classNames: ['cm-gutter'] }),
    } as unknown as Event;

    expect(getLineNumberElement(event)).toBeNull();

    globalThis.HTMLElement = originalHTMLElement;
  });
});
