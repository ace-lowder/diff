import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type KeyBinding,
} from '@codemirror/view';

import { editorDecorationsField } from './codeMirrorDecorations';
import { getTopVisibleLineNumber } from './codeMirrorScroll';
import type { CodeMirrorTheme, ScrollOffset } from '../appTypes';
import type { FontStyleType, TextChange } from '../fontStyles';

type CodeMirrorExtensionOptions = {
  ariaLabel: string;
  theme: CodeMirrorTheme;
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
};

export const getCodeMirrorExtensions = ({
  ariaLabel,
  theme,
  onDocumentChange,
  onFocusPane,
  onToggleFontStyle,
  onScroll,
}: CodeMirrorExtensionOptions): Extension[] => {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    keymap.of([
      ...getFontStyleKeyBindings(onToggleFontStyle),
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
      fontSize: '16px',
    },
    '.cm-editor': {
      height: '100%',
      backgroundColor,
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: '1.5',
    },
    '.cm-content': {
      padding: '8px 12px',
      caretColor: '#D4D4D4',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      backgroundColor,
      color: '#858889',
      border: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      boxSizing: 'border-box',
      width: '6ch',
      minWidth: '6ch',
      paddingLeft: '0',
      paddingRight: '2ch',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: '#242526',
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
    '.byline-added-text': {
      backgroundColor: '#2A4C2C',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      boxShadow: '0 -0.25em 0 #2A4C2C, 0 0.25em 0 #2A4C2C',
    },
    '.byline-deleted-text': {
      backgroundColor: '#693330',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      boxShadow: '0 -0.25em 0 #693330, 0 0.25em 0 #693330',
    },
    '.cm-line.byline-added-line': {
      backgroundColor: '#2A4C2C',
      boxShadow: '0 -0.25em 0 #2A4C2C, 0 0.25em 0 #2A4C2C',
    },
    '.byline-deleted-marker': {
      position: 'relative',
      display: 'inline-block',
      width: '0',
      height: '1em',
      verticalAlign: '-0.12em',
    },
    '.byline-deleted-marker-strip': {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '0.35ch',
      height: '1.5em',
      backgroundColor: '#693330',
    },
    '.byline-missing-line': {
      display: 'block',
      width: '100%',
      boxSizing: 'border-box',
      lineHeight: '1.5',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(140, 140, 140, 0.7) 0, rgba(140, 140, 140, 0.7) 2px, transparent 2px, transparent 6px)',
    },
    '.cm-line.byline-deleted-draft-line': {
      backgroundColor: '#693330',
      boxShadow: '0 -0.25em 0 #693330, 0 0.25em 0 #693330',
    },
    '.cm-line.byline-lowest-edited-line': {
      borderBottom: '1px dashed #8C8C8C',
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
