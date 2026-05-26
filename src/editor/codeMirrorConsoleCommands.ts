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

export type ConsoleCommandLineContext = {
  text: string;
  from: number;
  to: number;
  number: number;
};

export type ConsoleCommandContext = {
  pane: PaneId;
  previousLineText: string;
  previousLine: ConsoleCommandLineContext | null;
};

export type RunConsoleCommand = (
  command: ConsoleCommand,
  context: ConsoleCommandContext,
) => void;

export type CommandPanelPlacementInput = {
  cursorLeft: number;
  cursorTop: number;
  cursorBottom: number;
  editorLeft: number;
  editorTop: number;
  viewportHeight: number;
  optionCount: number;
};

export type CommandPanelPlacement = {
  left: number;
  top: number;
};

export type CommandLineRemovalEdit = {
  from: number;
  to: number;
  selectionAnchor: number;
};

type CommandPanelMeasurement = {
  cursorCoordinates: { left: number; top: number; bottom: number };
  editorRect: { left: number; top: number };
} | null;

const COMMAND_PANEL_VERTICAL_GAP_PX = 4;
const COMMAND_PANEL_OPTION_HEIGHT_PX = 24;
const COMMAND_PANEL_VERTICAL_PADDING_PX = 8;

export const getCommandPanelPlacement = ({
  cursorLeft,
  cursorTop,
  cursorBottom,
  editorLeft,
  editorTop,
  viewportHeight,
  optionCount,
}: CommandPanelPlacementInput): CommandPanelPlacement => {
  const estimatedPanelHeight =
    optionCount * COMMAND_PANEL_OPTION_HEIGHT_PX + COMMAND_PANEL_VERTICAL_PADDING_PX;

  const belowTop = cursorBottom - editorTop + COMMAND_PANEL_VERTICAL_GAP_PX;
  const aboveTop =
    cursorTop - editorTop - estimatedPanelHeight - COMMAND_PANEL_VERTICAL_GAP_PX;

  const shouldPlaceAbove =
    cursorBottom + estimatedPanelHeight + COMMAND_PANEL_VERTICAL_GAP_PX >
    viewportHeight;

  return {
    left: Math.max(0, cursorLeft - editorLeft),
    top: Math.max(0, shouldPlaceAbove ? aboveTop : belowTop),
  };
};

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
      panelRenderQueued = false;
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

          const previousLine = getPreviousLine(this.view, commandLine.number);
          const removalEdit = getCommandLineRemovalEdit({
            commandLine,
            previousLine,
          });
          this.view.dispatch({
            changes: {
              from: removalEdit.from,
              to: removalEdit.to,
              insert: '',
            },
            selection: { anchor: removalEdit.selectionAnchor },
          });

          this.onRunConsoleCommand(parseResult.command, {
            pane: this.pane,
            previousLine,
            previousLineText: previousLine?.text ?? '',
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
          this.schedulePanelRender();
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
          this.schedulePanelRender();
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
        this.schedulePanelRender();
      }

      moveSelection(delta: number): boolean {
        if (!this.menu || this.menu.options.length === 0) {
          return false;
        }

        const optionCount = this.menu.options.length;
        this.selectedIndex = (this.selectedIndex + delta + optionCount) % optionCount;
        this.decorations = this.getPredictionDecoration();
        this.schedulePanelRender();
        return true;
      }

      selectOption(index: number): boolean {
        if (!this.menu || index < 0 || index >= this.menu.options.length) {
          return false;
        }

        if (this.selectedIndex === index) {
          return true;
        }

        this.selectedIndex = index;
        this.decorations = this.getPredictionDecoration();
        this.schedulePanelRender();
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

      schedulePanelRender() {
        if (!this.panelElement) {
          return;
        }

        if (this.panelRenderQueued) {
          return;
        }

        this.panelRenderQueued = true;
        const optionCount = this.menu?.options.length ?? 0;

        this.view.requestMeasure({
          read: (view): CommandPanelMeasurement => {
            if (!optionCount) {
              return null;
            }
            const cursorCoordinates = view.coordsAtPos(this.cursorPosition);
            const editorRect = view.dom.getBoundingClientRect();
            if (!cursorCoordinates) {
              return null;
            }
            return {
              cursorCoordinates: {
                left: cursorCoordinates.left,
                top: cursorCoordinates.top,
                bottom: cursorCoordinates.bottom,
              },
              editorRect: {
                left: editorRect.left,
                top: editorRect.top,
              },
            };
          },
          write: (measurement: CommandPanelMeasurement) => {
            this.panelRenderQueued = false;
            const panelElement = this.panelElement;
            const menu = this.menu;

            if (!panelElement) {
              return;
            }

            if (!menu || menu.options.length === 0 || !measurement) {
              panelElement.style.display = 'none';
              panelElement.innerHTML = '';
              return;
            }

            const { cursorCoordinates, editorRect } = measurement;
            const placement = getCommandPanelPlacement({
              cursorLeft: cursorCoordinates.left,
              cursorTop: cursorCoordinates.top,
              cursorBottom: cursorCoordinates.bottom,
              editorLeft: editorRect.left,
              editorTop: editorRect.top,
              viewportHeight: window.innerHeight,
              optionCount: menu.options.length,
            });

            panelElement.innerHTML = '';
            panelElement.setAttribute('role', 'listbox');
            for (let index = 0; index < menu.options.length; index += 1) {
              const option = menu.options[index];
              const optionElement = document.createElement('div');
              optionElement.className =
                index === this.selectedIndex
                  ? 'byline-command-option byline-command-option-active'
                  : 'byline-command-option';
              optionElement.textContent = option.label;
              optionElement.setAttribute('role', 'option');
              optionElement.setAttribute(
                'aria-selected',
                index === this.selectedIndex ? 'true' : 'false',
              );
              optionElement.addEventListener('pointerenter', () => {
                this.selectOption(index);
              });
              optionElement.addEventListener('pointerdown', (event) => {
                event.preventDefault();
              });
              optionElement.addEventListener('click', (event) => {
                event.preventDefault();
                this.selectOption(index);
                this.completeSelection();
                this.view.focus();
              });
              panelElement.append(optionElement);
            }

            panelElement.style.display = 'block';
            panelElement.style.left = `${placement.left}px`;
            panelElement.style.top = `${placement.top}px`;
            panelElement.style.visibility = 'visible';
          },
        });
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

const getPreviousLine = (
  view: EditorView,
  commandLineNumber: number,
): ConsoleCommandLineContext | null => {
  if (commandLineNumber <= 1) {
    return null;
  }

  const line = view.state.doc.line(commandLineNumber - 1);
  return {
    text: line.text,
    from: line.from,
    to: line.to,
    number: line.number,
  };
};

export const getCommandLineRemovalEdit = ({
  commandLine,
  previousLine,
}: {
  commandLine: ConsoleCommandLineContext;
  previousLine: ConsoleCommandLineContext | null;
}): CommandLineRemovalEdit => {
  if (!previousLine) {
    return {
      from: commandLine.from,
      to: commandLine.to,
      selectionAnchor: commandLine.from,
    };
  }

  return {
    from: previousLine.to,
    to: commandLine.to,
    selectionAnchor: previousLine.to,
  };
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
