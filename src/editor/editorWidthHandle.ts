export type EditorWidthHandlePlacement =
  | 'none'
  | 'afterLeftGutter'
  | 'beforeRightGutter';

export const EDITOR_WIDTH_HANDLE_RIGHT_NUDGE_PX = 2;

export const getEditorWidthHandleStyle = ({
  placement,
  lineNumberGutterWidthPx,
  scrollbarWidthPx,
}: {
  placement: Exclude<EditorWidthHandlePlacement, 'none'>;
  lineNumberGutterWidthPx: number;
  scrollbarWidthPx: number;
}): { left?: string; right?: string } => {
  if (placement === 'beforeRightGutter') {
    return {
      right: `${lineNumberGutterWidthPx + scrollbarWidthPx + EDITOR_WIDTH_HANDLE_RIGHT_NUDGE_PX}px`,
    };
  }

  return { left: `${lineNumberGutterWidthPx}px` };
};
