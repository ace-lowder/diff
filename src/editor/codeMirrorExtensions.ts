import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  Annotation,
  EditorSelection,
  EditorState,
  Transaction,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  highlightActiveLineGutter,
  keymap,
  type KeyBinding,
} from "@codemirror/view";

import { editorDecorationsField } from "./codeMirrorDecorations";
import {
  getCodeMirrorConsoleCommandExtension,
  type RunConsoleCommand,
} from "./codeMirrorConsoleCommands";
import { getCodeMirrorDiffPaintExtension } from "./codeMirrorDiffPaint";
import { getCodeMirrorLineCopyExtension } from "./codeMirrorLineCopy";
import { getTopVisibleLineNumber } from "./codeMirrorScroll";
import { CODE_MIRROR_TAB_SIZE, insertTabCharacter } from "./codeMirrorTab";
import { getSelectionClipboardContent } from "../clipboardExport";
import { getRichTextClipboardContent } from "../clipboardImport";
import {
  CODE_MIRROR_FONT_SIZE,
  CODE_MIRROR_LINE_HEIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT,
  CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH,
} from "./codeMirrorThemeConstants";
import type {
  CodeMirrorTheme,
  CopyLineHandler,
  LineNumberPosition,
  LineNumberVisibilityMode,
  PaneId,
  ScrollOffset,
} from "../appTypes";
import type {
  FontStyleType,
  StyledDocumentChange,
  FontStyleRange,
  TextChange,
  TextSelectionRange,
} from "../fontStyles";
import {
  EDITOR_CONTENT_HORIZONTAL_PADDING_PX,
  LEFT_LINE_NUMBER_TEXT_NUDGE,
  RIGHT_LINE_NUMBER_TEXT_NUDGE,
  TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX,
  TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX,
} from "../layoutTuning";

const RIGHT_LINE_NUMBER_PADDING_LEFT = "1ch";
const RIGHT_LINE_NUMBER_PADDING_RIGHT = "3ch";
const LEFT_LINE_COPY_ICON_OFFSET = "calc(100% - 1.45ch)";
const RIGHT_LINE_COPY_ICON_OFFSET = "calc(100% - 3.2ch)";
const INSERTED_FONT_STYLE_RANGES_ANNOTATION =
  Annotation.define<StyledDocumentChange["insertedFontStyleRanges"]>();

type CodeMirrorExtensionOptions = {
  ariaLabel: string;
  pane: PaneId;
  theme: CodeMirrorTheme;
  onRunConsoleCommand: RunConsoleCommand;
  onDocumentChange: (change: StyledDocumentChange) => void;
  onFocusPane: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onScroll: (scrollOffset: ScrollOffset, topVisibleLineNumber: number) => void;
  onContentLayoutChange: () => void;
  onSelectionChange?: (selections: TextSelectionRange[]) => void;
  onCopyLine: CopyLineHandler;
  getFontStyleRanges: () => FontStyleRange[];
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
  onContentLayoutChange,
  onSelectionChange,
  onCopyLine,
  getFontStyleRanges,
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
      "aria-label": ariaLabel,
    }),
    EditorView.domEventHandlers({
      copy: (event, view) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false;
        }

        const content = getSelectionClipboardContent({
          text: view.state.doc.toString(),
          selections: view.state.selection.ranges,
          fontStyleRanges: getFontStyleRanges(),
        });

        if (!content) {
          return false;
        }

        event.preventDefault();
        clipboardData.setData("text/plain", content.plainText);
        clipboardData.setData("text/html", content.htmlText);
        return true;
      },
      paste: (event, view) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false;
        }

        const richTextClipboardContent = getRichTextClipboardContent({
          html: clipboardData.getData("text/html"),
          plainText: clipboardData.getData("text/plain"),
        });

        if (!richTextClipboardContent) {
          return false;
        }

        event.preventDefault();

        const insertedFontStyleRanges: StyledDocumentChange["insertedFontStyleRanges"] =
          [];
        const transaction = view.state.changeByRange((range) => {
          const insertedFrom = range.from;
          for (const fontStyleRange of richTextClipboardContent.fontStyleRanges) {
            insertedFontStyleRanges.push({
              type: fontStyleRange.type,
              from: insertedFrom + fontStyleRange.from,
              to: insertedFrom + fontStyleRange.to,
            });
          }

          return {
            changes: {
              from: range.from,
              to: range.to,
              insert: richTextClipboardContent.text,
            },
            range: EditorSelection.cursor(
              insertedFrom + richTextClipboardContent.text.length,
            ),
          };
        });

        view.dispatch({
          ...transaction,
          annotations: [
            INSERTED_FONT_STYLE_RANGES_ANNOTATION.of(insertedFontStyleRanges),
            Transaction.userEvent.of("input.paste"),
          ],
          scrollIntoView: true,
        });

        return true;
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const changes: TextChange[] = [];
        update.changes.iterChanges((fromA, toA, fromB, toB) => {
          changes.push({ fromA, toA, fromB, toB });
        });
        const insertedFontStyleRanges: StyledDocumentChange["insertedFontStyleRanges"] =
          [];
        for (const transaction of update.transactions) {
          const annotatedRanges = transaction.annotation(
            INSERTED_FONT_STYLE_RANGES_ANNOTATION,
          );
          if (annotatedRanges) {
            insertedFontStyleRanges.push(...annotatedRanges);
          }
        }
        onDocumentChange({ changes, insertedFontStyleRanges });
        if (update.startState.doc.lines !== update.state.doc.lines) {
          onContentLayoutChange();
        }
      }

      if (update.selectionSet && !update.docChanged) {
        onSelectionChange?.(getTextSelectionRanges(update.state));
      }
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
  const backgroundColor = theme === "draft" ? "#191A1B" : "#121314";
  const textColor = theme === "draft" ? "#BFBFBF" : "#D4D4D4";

  return EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor,
      color: textColor,
      fontSize: CODE_MIRROR_FONT_SIZE,
    },
    ".cm-editor": {
      height: "100%",
      backgroundColor,
      position: "relative",
    },
    ".cm-scroller": {
      height: "100%",
      overflow: "auto",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
    },
    ".cm-content": {
      padding: `8px ${EDITOR_CONTENT_HORIZONTAL_PADDING_PX}px`,
      caretColor: "#D4D4D4",
      tabSize: String(CODE_MIRROR_TAB_SIZE),
    },
    ".cm-line": {
      padding: "0",
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
      minHeight: CODE_MIRROR_LINE_HEIGHT,
      boxSizing: "border-box",
    },
    ".cm-gutters": {
      backgroundColor,
      color: "#858889",
      border: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      width: CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH,
      minWidth: CODE_MIRROR_LINE_NUMBER_GUTTER_WIDTH,
      paddingLeft: "0",
      paddingRight: CODE_MIRROR_LINE_NUMBER_GUTTER_PADDING_RIGHT,
      boxSizing: "border-box",
      textAlign: "right",
      cursor: "pointer",
      userSelect: "none",
      position: "relative",
      overflow: "visible",
    },
    ".byline-line-number-gutter-right .cm-gutterElement": {
      paddingLeft: RIGHT_LINE_NUMBER_PADDING_LEFT,
      paddingRight: RIGHT_LINE_NUMBER_PADDING_RIGHT,
    },
    ".byline-line-number-gutter-left .byline-line-number": {
      display: "inline-block",
      transform: `translateX(${LEFT_LINE_NUMBER_TEXT_NUDGE})`,
    },
    ".byline-line-number-gutter-right .byline-line-number": {
      display: "inline-block",
      transform: `translateX(${RIGHT_LINE_NUMBER_TEXT_NUDGE})`,
    },
    ".byline-line-number-gutter-left": {
      overflow: "visible",
    },
    ".cm-lineNumbers .cm-gutterElement:hover": {
      color: "#BBBEBF",
    },
    ".byline-line-copy-icon": {
      position: "absolute",
      left: LEFT_LINE_COPY_ICON_OFFSET,
      top: `calc(${CODE_MIRROR_LINE_HEIGHT} / 2)`,
      display: "inline-flex",
      transform: "translateY(-50%)",
      color: "#BBBEBF",
      opacity: "1",
      pointerEvents: "none",
      transition: "opacity 500ms ease-out",
    },
    ".byline-line-number-gutter-right .byline-line-copy-icon": {
      left: RIGHT_LINE_COPY_ICON_OFFSET,
    },
    ".byline-line-copy-icon-fading": {
      opacity: "0",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#BBBEBF",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-selectionBackground": {
      backgroundColor: "#264F78 !important",
    },
    ".byline-diff-active-line": {
      backgroundColor: "#242526",
    },
    ".byline-diff-added": {
      backgroundColor: "#2A4C2C",
    },
    ".byline-diff-deleted": {
      backgroundColor: "#693330",
    },
    ".byline-typing-diff": {
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
      paddingTop: `${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`,
      paddingBottom: `${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`,
      marginTop: `-${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`,
      marginBottom: `-${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`,
    },
    ".byline-typing-diff-added": {
      backgroundColor: "#2A4C2C",
      boxShadow: `0 0 0 ${TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX}px #2A4C2C`,
    },
    ".byline-typing-diff-deleted": {
      backgroundColor: "#693330",
      boxShadow: `0 0 0 ${TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX}px #693330`,
    },
    ".byline-missing-line": {
      display: "block",
      position: "relative",
      margin: "0",
      padding: "0",
      border: "0",
      boxSizing: "border-box",
      lineHeight: CODE_MIRROR_LINE_HEIGHT,
    },
    ".byline-missing-line-paint": {
      display: "block",
      margin: "0",
      padding: "0",
      border: "0",
      boxSizing: "border-box",
      backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(140, 140, 140, 0.7) 0, rgba(140, 140, 140, 0.7) 2px, transparent 2px, transparent 6px)",
    },
    ".byline-lowest-edited-line-marker": {
      backgroundColor: "transparent",
      backgroundImage:
        "repeating-linear-gradient(to right, #8C8C8C 0, #8C8C8C 2px, transparent 2px, transparent 6px)",
    },
    ".byline-command-panel": {
      backgroundColor: "#191A1B",
      border: "1px solid #2A2B2C",
      borderRadius: "6px",
      padding: "4px",
      minWidth: "120px",
      boxShadow: "0 6px 24px rgba(0, 0, 0, 0.45)",
    },
    ".byline-command-option": {
      color: "#BFBFBF",
      padding: "3px 8px",
      borderRadius: "4px",
      lineHeight: "1.4",
      whiteSpace: "nowrap",
    },
    ".byline-command-option-active": {
      backgroundColor: "#242526",
    },
    ".byline-command-prediction": {
      color: "#6F7375",
      pointerEvents: "none",
    },
    ".byline-font-bold": {
      fontWeight: "800",
      WebkitTextStroke: "0.4px currentColor",
      paintOrder: "stroke fill",
    },
    ".byline-font-italic": {
      fontStyle: "italic",
    },
    ".byline-font-underline": {
      textDecoration: "underline",
    },
  });
};

const getFontStyleKeyBindings = (
  onToggleFontStyle: (fontStyleType: FontStyleType) => void,
): KeyBinding[] => {
  return [
    {
      key: "Mod-b",
      run: () => {
        onToggleFontStyle("bold");
        return true;
      },
    },
    {
      key: "Mod-i",
      run: () => {
        onToggleFontStyle("italic");
        return true;
      },
    },
    {
      key: "Mod-u",
      run: () => {
        onToggleFontStyle("underline");
        return true;
      },
    },
  ];
};

const getTextSelectionRanges = (state: EditorState): TextSelectionRange[] => {
  return state.selection.ranges
    .map((range) => ({
      from: range.from,
      to: range.to,
    }))
    .filter((range) => range.to > range.from);
};
