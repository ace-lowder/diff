import { Prec, type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type ViewUpdate,
  ViewPlugin,
  WidgetType,
  keymap,
} from '@codemirror/view';

import type { PaneId } from '../appTypes';
import type { ConsoleCommand } from './consoleCommands';
import {
  getCompletedConsoleCommandLine,
  getConsoleCommandMenu,
  getConsoleCommandPrediction,
  getNoLineAboveCommandLineText,
  getUnknownCommandLineText,
  parseConsoleCommandLine,
} from './consoleCommands';

export type ConsoleCommandContext = {
  pane: PaneId;
  previousLineText: string;
};

export type RunConsoleCommand = (
  command: ConsoleCommand,
  context: ConsoleCommandContext,
) => void;

export const getCodeMirrorConsoleCommandExtension = ({
  pane,
  onRunConsoleCommand,
}: {
  pane: PaneId;
  onRunConsoleCommand: RunConsoleCommand;
}): Extension[] => {
  const commandPlugin = ViewPlugin.fromClass(
    class {
      readonly view: EditorView;
      readonly pane: PaneId;
      readonly onRunConsoleCommand: RunConsoleCommand;
      panelElement: HTMLDivElement | null = null;
      menu: ReturnType<typeof getConsoleCommandMenu> = null;
      selectedIndex = 0;
      cursorPosition = 0;
      commandLineFrom = 0;
      commandLineTo = 0;
      commandLineText = '';
      decorations: DecorationSet = Decoration.none;

      constructor(view: EditorView) {
        this.view = view;
        this.pane = pane;
        this.onRunConsoleCommand = onRunConsoleCommand;
        this.panelElement = createCommandPanel();
        this.view.dom.append(this.panelElement);
        this.updateState();
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.geometryChanged
        ) {
          this.updateState();
        }
      }

      destroy() {
        this.panelElement?.remove();
        this.panelElement = null;
      }

      completeSelection(): boolean {
        if (!this.menu) {
          return false;
        }

        const selectedOption = this.menu.options[this.selectedIndex];
        if (!selectedOption) {
          return false;
        }

        const completedLine = getCompletedConsoleCommandLine({
          lineText: this.commandLineText,
          cursorOffset: this.cursorPosition - this.commandLineFrom,
          selectedLabel: selectedOption.label,
        });

        if (completedLine === null || completedLine === this.commandLineText) {
          return false;
        }

        const nextCursorPosition = this.commandLineFrom + completedLine.length;
        this.view.dispatch({
          changes: {
            from: this.commandLineFrom,
            to: this.commandLineTo,
            insert: completedLine,
          },
          selection: { anchor: nextCursorPosition },
        });

        return true;
      }

      executeOrHandleEnter(): boolean {
        const commandLine = getCurrentCommandLine(this.view);
        if (!commandLine) {
          return false;
        }

        const parseResult = parseConsoleCommandLine(commandLine.text);

        if (parseResult.kind === 'valid') {
          if (
            parseResult.command.type === 'copy' &&
            parseResult.command.target === 'line' &&
            commandLine.number <= 1
          ) {
            const errorText = getNoLineAboveCommandLineText(commandLine.text);
            const insertText = `${errorText}\n`;
            const nextCursorPosition = commandLine.from + insertText.length;
            this.view.dispatch({
              changes: {
                from: commandLine.from,
                to: commandLine.to,
                insert: insertText,
              },
              selection: { anchor: nextCursorPosition },
            });
            return true;
          }

          const previousLineText = getPreviousLineText(this.view, commandLine.number);
          this.view.dispatch({
            changes: {
              from: commandLine.from,
              to: commandLine.to,
              insert: '',
            },
            selection: { anchor: commandLine.from },
          });

          this.onRunConsoleCommand(parseResult.command, {
            pane: this.pane,
            previousLineText,
          });
          return true;
        }

        if (parseResult.kind === 'unknown-command') {
          const unknownText = getUnknownCommandLineText(commandLine.text);
          const insertText = `${unknownText}\n`;
          const nextCursorPosition = commandLine.from + insertText.length;
          this.view.dispatch({
            changes: {
              from: commandLine.from,
              to: commandLine.to,
              insert: insertText,
            },
            selection: { anchor: nextCursorPosition },
          });
          return true;
        }

        return false;
      }

      updateState() {
        const commandLine = getCurrentCommandLine(this.view);

        if (!commandLine) {
          this.menu = null;
          this.decorations = Decoration.none;
          this.renderPanel();
          return;
        }

        this.cursorPosition = this.view.state.selection.main.head;
        this.commandLineFrom = commandLine.from;
        this.commandLineTo = commandLine.to;
        this.commandLineText = commandLine.text;

        const nextMenu = getConsoleCommandMenu({
          lineText: commandLine.text,
          cursorOffset: this.cursorPosition - commandLine.from,
        });

        const previousLabel = this.menu?.options[this.selectedIndex]?.label;
        this.menu = nextMenu;

        if (!nextMenu || nextMenu.options.length === 0) {
          this.selectedIndex = 0;
          this.decorations = Decoration.none;
          this.renderPanel();
          return;
        }

        const previousIndex = previousLabel
          ? nextMenu.options.findIndex((option) => option.label === previousLabel)
          : -1;

        this.selectedIndex =
          previousIndex >= 0
            ? previousIndex
            : Math.max(0, Math.min(this.selectedIndex, nextMenu.options.length - 1));

        this.decorations = this.getPredictionDecoration();
        this.renderPanel();
      }

      moveSelection(delta: number): boolean {
        if (!this.menu || this.menu.options.length === 0) {
          return false;
        }

        const optionCount = this.menu.options.length;
        this.selectedIndex = (this.selectedIndex + delta + optionCount) % optionCount;
        this.decorations = this.getPredictionDecoration();
        this.renderPanel();
        return true;
      }

      isCompletionPending(): boolean {
        if (!this.menu) {
          return false;
        }

        const selectedOption = this.menu.options[this.selectedIndex];
        if (!selectedOption) {
          return false;
        }

        const completedLine = getCompletedConsoleCommandLine({
          lineText: this.commandLineText,
          cursorOffset: this.cursorPosition - this.commandLineFrom,
          selectedLabel: selectedOption.label,
        });

        return completedLine !== null && completedLine !== this.commandLineText;
      }

      getPredictionDecoration(): DecorationSet {
        if (!this.menu) {
          return Decoration.none;
        }

        const selectedOption = this.menu.options[this.selectedIndex];
        if (!selectedOption) {
          return Decoration.none;
        }

        const predictionText = getConsoleCommandPrediction({
          lineText: this.commandLineText,
          cursorOffset: this.cursorPosition - this.commandLineFrom,
          selectedLabel: selectedOption.label,
        });

        if (!predictionText) {
          return Decoration.none;
        }

        const widget = Decoration.widget({
          side: 1,
          widget: new PredictionWidget(predictionText),
        });

        return Decoration.set([widget.range(this.cursorPosition)]);
      }

      renderPanel() {
        if (!this.panelElement) {
          return;
        }

        if (!this.menu || this.menu.options.length === 0) {
          this.panelElement.style.display = 'none';
          this.panelElement.innerHTML = '';
          return;
        }

        const cursorCoordinates = this.view.coordsAtPos(this.cursorPosition);
        if (!cursorCoordinates) {
          this.panelElement.style.display = 'none';
          this.panelElement.innerHTML = '';
          return;
        }

        this.panelElement.innerHTML = '';
        for (let index = 0; index < this.menu.options.length; index += 1) {
          const option = this.menu.options[index];
          const optionElement = document.createElement('div');
          optionElement.className =
            index === this.selectedIndex
              ? 'byline-command-option byline-command-option-active'
              : 'byline-command-option';
          optionElement.textContent = option.label;
          this.panelElement.append(optionElement);
        }

        this.panelElement.style.display = 'block';
        this.panelElement.style.visibility = 'hidden';
        this.panelElement.style.left = '0';
        this.panelElement.style.top = '0';

        const editorRect = this.view.dom.getBoundingClientRect();
        const panelRect = this.panelElement.getBoundingClientRect();
        const verticalGap = 4;
        const left = cursorCoordinates.left - editorRect.left;
        const belowTop = cursorCoordinates.bottom - editorRect.top + verticalGap;
        const aboveTop =
          cursorCoordinates.top - editorRect.top - panelRect.height - verticalGap;
        const editorBottomSpace = window.innerHeight - editorRect.bottom;
        const placeAbove =
          cursorCoordinates.bottom + panelRect.height + verticalGap >
          window.innerHeight - editorBottomSpace;
        const top = placeAbove ? aboveTop : belowTop;

        this.panelElement.style.left = `${left}px`;
        this.panelElement.style.top = `${Math.max(0, top)}px`;
        this.panelElement.style.visibility = 'visible';
      }
    },
    {
      decorations: (value) => value.decorations,
    },
  );

  return [
    commandPlugin,
    Prec.highest(
      keymap.of([
        {
          key: 'ArrowDown',
          run: (view) => {
            const pluginValue = view.plugin(commandPlugin);
            return pluginValue ? pluginValue.moveSelection(1) : false;
          },
        },
        {
          key: 'ArrowUp',
          run: (view) => {
            const pluginValue = view.plugin(commandPlugin);
            return pluginValue ? pluginValue.moveSelection(-1) : false;
          },
        },
        {
          key: 'Tab',
          run: (view) => {
            const pluginValue = view.plugin(commandPlugin);
            if (!pluginValue) {
              return false;
            }

            return pluginValue.completeSelection();
          },
        },
        {
          key: 'Enter',
          run: (view) => {
            const pluginValue = view.plugin(commandPlugin);
            if (!pluginValue) {
              return false;
            }

            if (pluginValue.isCompletionPending()) {
              return pluginValue.completeSelection();
            }

            return pluginValue.executeOrHandleEnter();
          },
        },
      ]),
    ),
  ];
};

// === Helpers ===

const getCurrentCommandLine = (view: EditorView): {
  from: number;
  to: number;
  text: string;
  number: number;
} | null => {
  if (view.state.selection.ranges.length !== 1) {
    return null;
  }

  const selection = view.state.selection.main;
  if (!selection.empty) {
    return null;
  }

  const line = view.state.doc.lineAt(selection.head);
  if (!line.text.startsWith('/')) {
    return null;
  }

  return {
    from: line.from,
    to: line.to,
    text: line.text,
    number: line.number,
  };
};

const getPreviousLineText = (view: EditorView, lineNumber: number): string => {
  if (lineNumber <= 1) {
    return '';
  }

  return view.state.doc.line(lineNumber - 1).text;
};

const createCommandPanel = (): HTMLDivElement => {
  const element = document.createElement('div');
  element.className = 'byline-command-panel';
  element.style.position = 'absolute';
  element.style.zIndex = '1000';
  element.style.display = 'none';
  return element;
};

class PredictionWidget extends WidgetType {
  readonly predictionText: string;

  constructor(predictionText: string) {
    super();
    this.predictionText = predictionText;
  }

  eq(other: PredictionWidget): boolean {
    return this.predictionText === other.predictionText;
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span');
    element.className = 'byline-command-prediction';
    element.textContent = this.predictionText;
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
}
