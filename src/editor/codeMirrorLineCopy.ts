import type { Extension } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  lineNumbers,
  type BlockInfo,
} from '@codemirror/view';

import type { CopyLineHandler, PaneId, TextLineContext } from '../appTypes';

export const LINE_COPY_ICON_FADE_MS = 300;
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

const getLineNumberElement = (event: Event): HTMLElement | null => {
  if (event.currentTarget instanceof HTMLElement) {
    return event.currentTarget;
  }

  if (event.target instanceof HTMLElement) {
    return event.target.closest('.cm-gutterElement');
  }

  return null;
};

export const getCodeMirrorLineCopyExtension = ({
  pane,
  onCopyLine,
}: {
  pane: PaneId;
  onCopyLine: CopyLineHandler;
}): Extension[] => {
  const lineCopyPlugin = ViewPlugin.fromClass(
    class {
      readonly view: EditorView;
      readonly pane: PaneId;
      readonly onCopyLine: CopyLineHandler;
      copyFlashTimeouts: number[] = [];
      copyFlashFrameIds: number[] = [];

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

        for (const frameId of this.copyFlashFrameIds) {
          window.cancelAnimationFrame(frameId);
        }
        this.copyFlashFrameIds = [];
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

        const frameId = window.requestAnimationFrame(() => {
          iconElement.classList.add(LINE_COPY_ICON_FADING_CLASS_NAME);
          this.copyFlashFrameIds = this.copyFlashFrameIds.filter((id) => id !== frameId);
        });
        this.copyFlashFrameIds.push(frameId);

        const timeoutId = window.setTimeout(() => {
          iconElement.remove();
          this.copyFlashTimeouts = this.copyFlashTimeouts.filter((id) => id !== timeoutId);
        }, LINE_COPY_ICON_FADE_MS);
        this.copyFlashTimeouts.push(timeoutId);
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

  return [
    lineCopyPlugin,
    lineNumbers({
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
  ];
};
