import { StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  lineNumbers,
  type BlockInfo,
} from '@codemirror/view';

import type { CopyLineHandler, PaneId, TextLineContext } from '../appTypes';

const LINE_NUMBER_COPY_STATUS_MS = 1500;
export const LINE_NUMBER_COPY_CHECK_MARK = '✓';

const setCopiedLineNumberEffect = StateEffect.define<number | null>();

const copiedLineNumberField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    let nextValue = transaction.docChanged ? null : value;

    for (const effect of transaction.effects) {
      if (effect.is(setCopiedLineNumberEffect)) {
        nextValue = effect.value;
      }
    }

    return nextValue;
  },
});

export const getLineNumberLabel = ({
  lineNumber,
  copiedLineNumber,
}: {
  lineNumber: number;
  copiedLineNumber: number | null;
}): string => {
  return copiedLineNumber === lineNumber
    ? LINE_NUMBER_COPY_CHECK_MARK
    : String(lineNumber);
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
      copyStatusTimeout: number | null = null;

      constructor(view: EditorView) {
        this.view = view;
        this.pane = pane;
        this.onCopyLine = onCopyLine;
      }

      destroy() {
        if (this.copyStatusTimeout !== null) {
          window.clearTimeout(this.copyStatusTimeout);
          this.copyStatusTimeout = null;
        }
      }

      async copyLine(block: BlockInfo) {
        try {
          const line = getTextLineContext(this.view, block);
          const didCopy = await this.onCopyLine({
            pane: this.pane,
            line,
          });

          if (!didCopy) {
            return;
          }

          this.view.dispatch({
            effects: setCopiedLineNumberEffect.of(line.number),
          });

          if (this.copyStatusTimeout !== null) {
            window.clearTimeout(this.copyStatusTimeout);
          }

          this.copyStatusTimeout = window.setTimeout(() => {
            this.view.dispatch({
              effects: setCopiedLineNumberEffect.of(null),
            });
            this.copyStatusTimeout = null;
          }, LINE_NUMBER_COPY_STATUS_MS);
        } catch {
          // Ignore copy errors and keep existing line number label.
        }
      }
    },
  );

  return [
    copiedLineNumberField,
    lineCopyPlugin,
    lineNumbers({
      formatNumber(lineNumber, state) {
        return getLineNumberLabel({
          lineNumber,
          copiedLineNumber: state.field(copiedLineNumberField),
        });
      },
      domEventHandlers: {
        click(view, block, event) {
          event.preventDefault();
          event.stopPropagation();
          const plugin = view.plugin(lineCopyPlugin);
          void plugin?.copyLine(block);
          return true;
        },
      },
    }),
  ];
};
