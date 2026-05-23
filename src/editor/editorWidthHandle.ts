import {
  LEFT_RESIZE_HANDLE_NUDGE_PX,
  RIGHT_RESIZE_HANDLE_NUDGE_PX,
} from '../layoutTuning';

export type EditorWidthHandlePlacement =
  | 'none'
  | 'afterLeftGutter'
  | 'beforeRightGutter';

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
      right: `${lineNumberGutterWidthPx + scrollbarWidthPx + RIGHT_RESIZE_HANDLE_NUDGE_PX}px`,
    };
  }

  return { left: `${lineNumberGutterWidthPx + LEFT_RESIZE_HANDLE_NUDGE_PX}px` };
};
