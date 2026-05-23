import {
  defaultKeymap,
  history,
  historyKeymap,
} from '@codemirror/commands';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLineGutter,
  keymap,
  type KeyBinding,
} from '@codemirror/view';

import { editorDecorationsField } from './codeMirrorDecorations';
import {
  getCodeMirrorConsoleCommandExtension,
  type RunConsoleCommand,
} from './codeMirrorConsoleCommands';
import { getCodeMirrorDiffPaintExtension } from './codeMirrorDiffPaint';
import { getCodeMirrorLineCopyExtension } from './codeMirrorLineCopy';
import { getTopVisibleLineNumber } from './codeMirrorScroll';
import { CODE_MIRROR_TAB_SIZE, insertTabCharacter } from './codeMirrorTab';
import {
  CODE_MIRROR_FONT_SIZE,
  CODE_MIRROR_LINE_HEIGHT,
} from './codeMirrorThemeConstants';
import type {
  CodeMirrorTheme,
  CopyLineHandler,
  LineNumberPosition,
  LineNumberVisibilityMode,
  PaneId,
  ScrollOffset,
} from '../appTypes';
import type { FontStyleType, TextChange } from '../fontStyles';

type CodeMirrorExtensionOptions = {
  ariaLabel: string;
  pane: PaneId;
  theme: CodeMirrorTheme;
  onRunConsoleCommand: RunConsoleCommand;
  onDocumentChange: ({
    value,
    changes,
  }: {
    value: string;
    changes: TextChange[];
  }) => void;
  onFocusPane: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onScroll: (scrollOffset: ScrollOffset, topVisibleLineNumber: number) => void;
  onCopyLine: CopyLineHandler;
  lineNumberPosition: LineNumberPosition;
  lineNumberVisibilityMode: LineNumberVisibilityMode;
  areLineNumbersVisible: boolean;
};

export const getCodeMirrorExtensions = ({
  ariaLabel,
  pane,
  theme,
  onRunConsoleCommand,
  onDocumentChange,
  onFocusPane,
  onToggleFontStyle,
  onScroll,
  onCopyLine,
  lineNumberPosition,
  lineNumberVisibilityMode,
  areLineNumbersVisible,
}: CodeMirrorExtensionOptions): Extension[] => {
  return [
    ...getCodeMirrorLineCopyExtension({
      pane,
      onCopyLine,
      position: lineNumberPosition,
      visibilityMode: lineNumberVisibilityMode,
      isVisible: areLineNumbersVisible,
    }),
    highlightActiveLineGutter(),
    history(),
    ...getCodeMirrorConsoleCommandExtension({
      pane,
      onRunConsoleCommand,
    }),
    keymap.of([
      ...getFontStyleKeyBindings(onToggleFontStyle),
      insertTabCharacter,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': ariaLabel,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }

      const changes: TextChange[] = [];
      update.changes.iterChanges((fromA, toA, fromB, toB) => {
        changes.push({ fromA, toA, fromB, toB });
      });
      onDocumentChange({ value: update.state.doc.toString(), changes });
    }),
    EditorView.domEventHandlers({
      scroll: (_event, view) => {
        onScroll(
          {
            left: view.scrollDOM.scrollLeft,
            top: view.scrollDOM.scrollTop,
          },
          getTopVisibleLineNumber(view),
        );
      },
      focus: () => {
        onFocusPane();
      },
    }),
    editorDecorationsField,
    ...getCodeMirrorDiffPaintExtension(theme),
    EditorState.tabSize.of(CODE_MIRROR_TAB_SIZE),
    getCodeMirrorTheme(theme),
  ];
};

const getCodeMirrorTheme = (theme: CodeMirrorTheme): Extension => {
  const backgroundColor = theme === 'draft' ? '#191A1B' : '#121314';
  const textColor = theme === 'draft' ? '#BFBFBF' : '#D4D4D4';

  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor,
      color: textColor,
      fontSize: CODE_MIRROR_FONT_SIZE,
    },
    '.cm-editor': {
      height: '100%',
      backgroundColor,
      position: 'relative',
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
    },
    '.cm-content': {
      padding: '8px 12px',
      caretColor: '#D4D4D4',
      tabSize: String(CODE_MIRROR_TAB_SIZE),
    },
    '.cm-line': {
      padding: '0',
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
      minHeight: CODE_MIRROR_LINE_HEIGHT,
      boxSizing: 'border-box',
    },
    '.cm-gutters': {
      backgroundColor,
      color: '#858889',
      border: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      width: '6ch',
      minWidth: '6ch',
      paddingLeft: '0',
      paddingRight: '2ch',
      textAlign: 'right',
      cursor: 'pointer',
      userSelect: 'none',
      position: 'relative',
      overflow: 'visible',
    },
    '.byline-line-numbers-right .cm-lineNumbers .cm-gutterElement': {
      paddingLeft: '1ch',
      paddingRight: '2ch',
    },
    '.cm-lineNumbers .cm-gutterElement:hover': {
      color: '#BBBEBF',
    },
    '.byline-line-copy-icon': {
      position: 'absolute',
      left: 'calc(100% - 1.65ch)',
      top: '50%',
      display: 'inline-flex',
      transform: 'translateY(-50%)',
      color: '#BBBEBF',
      opacity: '1',
      pointerEvents: 'none',
      transition: 'opacity 500ms ease-out',
    },
    '.byline-line-numbers-right .byline-line-copy-icon': {
      left: 'calc(100% - 1.1ch)',
    },
    '.byline-line-copy-icon-fading': {
      opacity: '0',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#BBBEBF',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#264F78 !important',
    },
    '.byline-diff-active-line': {
      backgroundColor: '#242526',
    },
    '.byline-diff-added': {
      backgroundColor: '#2A4C2C',
    },
    '.byline-diff-deleted': {
      backgroundColor: '#693330',
    },
    '.byline-missing-line': {
      display: 'block',
      position: 'relative',
      margin: '0',
      padding: '0',
      border: '0',
      boxSizing: 'border-box',
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
    },
    '.byline-missing-line-paint': {
      display: 'block',
      margin: '0',
      padding: '0',
      border: '0',
      boxSizing: 'border-box',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(140, 140, 140, 0.7) 0, rgba(140, 140, 140, 0.7) 2px, transparent 2px, transparent 6px)',
    },
    '.byline-lowest-edited-line-marker': {
      backgroundColor: 'transparent',
      backgroundImage:
        'repeating-linear-gradient(to right, #8C8C8C 0, #8C8C8C 2px, transparent 2px, transparent 6px)',
    },
    '.byline-command-panel': {
      backgroundColor: '#191A1B',
      border: '1px solid #2A2B2C',
      borderRadius: '6px',
      padding: '4px',
      minWidth: '120px',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
    },
    '.byline-command-option': {
      color: '#BFBFBF',
      padding: '3px 8px',
      borderRadius: '4px',
      lineHeight: '1.4',
      whiteSpace: 'nowrap',
    },
    '.byline-command-option-active': {
      backgroundColor: '#242526',
    },
    '.byline-command-prediction': {
      color: '#6F7375',
      pointerEvents: 'none',
    },
    '.byline-font-bold': {
      fontWeight: '700',
    },
    '.byline-font-italic': {
      fontStyle: 'italic',
    },
    '.byline-font-underline': {
      textDecoration: 'underline',
    },
  });
};

const getFontStyleKeyBindings = (
  onToggleFontStyle: (fontStyleType: FontStyleType) => void,
): KeyBinding[] => {
  return [
    {
      key: 'Mod-b',
      run: () => {
        onToggleFontStyle('bold');
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: () => {
        onToggleFontStyle('italic');
        return true;
      },
    },
    {
      key: 'Mod-u',
      run: () => {
        onToggleFontStyle('underline');
        return true;
      },
    },
  ];
};
