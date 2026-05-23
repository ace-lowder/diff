import {
  Compartment,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  GutterMarker,
  gutter,
  gutters,
  ViewPlugin,
  type BlockInfo,
  type EditorView,
} from '@codemirror/view';

import type {
  CopyLineHandler,
  LineNumberPosition,
  LineNumberVisibilityMode,
  PaneId,
  TextLineContext,
} from '../appTypes';

export const lineNumberCompartment = new Compartment();

export const setLineNumberSettingsEffect = StateEffect.define<{
  position: LineNumberPosition;
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
}>();

export const lineNumberSettingsField = StateField.define<{
  position: LineNumberPosition;
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
}>({
  create() {
    return {
      position: 'left',
      visibilityMode: 'visible',
      isVisible: true,
    };
  },
  update(value, transaction) {
    let nextValue = value;

    for (const effect of transaction.effects) {
      if (effect.is(setLineNumberSettingsEffect)) {
        nextValue = effect.value;
      }
    }

    return nextValue;
  },
});

export const LINE_COPY_ICON_VISIBLE_MS = 500;
export const LINE_COPY_ICON_FADE_MS = 500;
export const LINE_COPY_ICON_REMOVE_MS =
  LINE_COPY_ICON_VISIBLE_MS + LINE_COPY_ICON_FADE_MS;
export const LINE_COPY_ICON_CLASS_NAME = 'byline-line-copy-icon';
export const LINE_COPY_ICON_FADING_CLASS_NAME = 'byline-line-copy-icon-fading';

export const getLineCopyIconMarkup = (): string => {
  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
};

export const shouldShowLineNumberGutter = ({
  visibilityMode,
  isVisible,
}: {
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
}): boolean => {
  return visibilityMode === 'visible' || isVisible;
};

export const getLineNumberGutterSide = (
  position: LineNumberPosition,
): 'before' | 'after' => {
  return position === 'right' ? 'after' : 'before';
};

export const getLineNumberGutterClassName = (
  position: LineNumberPosition,
): string => {
  return `cm-lineNumbers byline-line-number-gutter byline-line-number-gutter-${position}`;
};

class LineNumberMarker extends GutterMarker {
  readonly lineNumber: number;

  constructor(lineNumber: number) {
    super();
    this.lineNumber = lineNumber;
  }

  eq(other: LineNumberMarker): boolean {
    return other.lineNumber === this.lineNumber;
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div');
    element.textContent = String(this.lineNumber);
    element.className = 'byline-line-number';
    return element;
  }
}

const getTextLineContext = (
  view: EditorView,
  block: BlockInfo,
): TextLineContext => {
  const line = view.state.doc.lineAt(block.from);

  return {
    text: line.text,
    from: line.from,
    to: line.to,
    number: line.number,
  };
};

export const getLineNumberElement = (event: Event): HTMLElement | null => {
  if (event.target instanceof HTMLElement) {
    const lineNumberElement = event.target.closest('.cm-gutterElement');

    if (lineNumberElement instanceof HTMLElement) {
      return lineNumberElement;
    }
  }

  if (
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.classList.contains('cm-gutterElement')
  ) {
    return event.currentTarget;
  }

  return null;
};

const getLineCopyPlugin = ({
  pane,
  onCopyLine,
}: {
  pane: PaneId;
  onCopyLine: CopyLineHandler;
}) => {
  return ViewPlugin.fromClass(
    class {
      readonly view: EditorView;
      readonly pane: PaneId;
      readonly onCopyLine: CopyLineHandler;
      copyFlashTimeouts: number[] = [];

      constructor(view: EditorView) {
        this.view = view;
        this.pane = pane;
        this.onCopyLine = onCopyLine;
      }

      destroy() {
        for (const timeoutId of this.copyFlashTimeouts) {
          window.clearTimeout(timeoutId);
        }
        this.copyFlashTimeouts = [];
      }

      showCopyIconFlash(lineNumberElement: HTMLElement): void {
        const existingIcon = lineNumberElement.querySelector(
          `.${LINE_COPY_ICON_CLASS_NAME}`,
        );
        existingIcon?.remove();

        const iconElement = document.createElement('span');
        iconElement.className = LINE_COPY_ICON_CLASS_NAME;
        iconElement.setAttribute('aria-hidden', 'true');
        iconElement.innerHTML = getLineCopyIconMarkup();
        lineNumberElement.append(iconElement);

        const fadeTimeoutId = window.setTimeout(() => {
          iconElement.classList.add(LINE_COPY_ICON_FADING_CLASS_NAME);
          this.copyFlashTimeouts = this.copyFlashTimeouts.filter(
            (id) => id !== fadeTimeoutId,
          );
        }, LINE_COPY_ICON_VISIBLE_MS);
        this.copyFlashTimeouts.push(fadeTimeoutId);

        const removeTimeoutId = window.setTimeout(() => {
          iconElement.remove();
          this.copyFlashTimeouts = this.copyFlashTimeouts.filter(
            (id) => id !== removeTimeoutId,
          );
        }, LINE_COPY_ICON_REMOVE_MS);
        this.copyFlashTimeouts.push(removeTimeoutId);
      }

      async copyLine({
        block,
        lineNumberElement,
      }: {
        block: BlockInfo;
        lineNumberElement: HTMLElement | null;
      }): Promise<void> {
        try {
          const line = getTextLineContext(this.view, block);
          const didCopy = await this.onCopyLine({
            pane: this.pane,
            line,
          });

          if (!didCopy) {
            return;
          }

          if (!lineNumberElement || !lineNumberElement.isConnected) {
            return;
          }

          this.showCopyIconFlash(lineNumberElement);
        } catch {
          // Ignore copy errors and show no icon.
        }
      }
    },
  );
};

const getLineNumberGutterExtension = ({
  position,
  pane,
  onCopyLine,
}: {
  position: LineNumberPosition;
  pane: PaneId;
  onCopyLine: CopyLineHandler;
}): Extension => {
  const lineCopyPlugin = getLineCopyPlugin({ pane, onCopyLine });

  return [
    lineCopyPlugin,
    gutter({
      class: getLineNumberGutterClassName(position),
      side: getLineNumberGutterSide(position),
      lineMarker(view, line) {
        return new LineNumberMarker(view.state.doc.lineAt(line.from).number);
      },
      initialSpacer() {
        return new LineNumberMarker(999);
      },
      domEventHandlers: {
        click(view, block, event) {
          event.preventDefault();
          event.stopPropagation();
          const lineNumberElement = getLineNumberElement(event);
          const plugin = view.plugin(lineCopyPlugin);
          void plugin?.copyLine({
            block,
            lineNumberElement,
          });
          return true;
        },
      },
    }),
    gutters({ fixed: true }),
  ];
};

export const getCodeMirrorLineCopyExtension = ({
  pane,
  onCopyLine,
  position,
  visibilityMode,
  isVisible,
}: {
  pane: PaneId;
  onCopyLine: CopyLineHandler;
  position: LineNumberPosition;
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
}): Extension[] => {
  const initialSettings = { position, visibilityMode, isVisible };

  return [
    lineNumberSettingsField,
    lineNumberCompartment.of(
      shouldShowLineNumberGutter(initialSettings)
        ? getLineNumberGutterExtension({ position, pane, onCopyLine })
        : [],
    ),
  ];
};

export const getLineNumberReconfigureEffects = ({
  position,
  visibilityMode,
  isVisible,
  pane,
  onCopyLine,
}: {
  position: LineNumberPosition;
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
  pane: PaneId;
  onCopyLine: CopyLineHandler;
}): StateEffect<unknown>[] => {
  const settings = { position, visibilityMode, isVisible };

  return [
    setLineNumberSettingsEffect.of(settings),
    lineNumberCompartment.reconfigure(
      shouldShowLineNumberGutter(settings)
        ? getLineNumberGutterExtension({ position, pane, onCopyLine })
        : [],
    ),
  ];
};
