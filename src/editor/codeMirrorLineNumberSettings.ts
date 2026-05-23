import type {
  LineNumberPosition,
  LineNumberVisibilityMode,
} from '../appTypes';
import { MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME } from '../pointerEvents';

export const LINE_NUMBER_AUTO_HIDE_DELAY_MS = 2000;
export const LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME =
  'w-[var(--byline-line-number-gutter-width)]';

export const getCodeMirrorPaneLineNumberClassName = ({
  position,
  visibilityMode,
  isVisible,
}: {
  position: LineNumberPosition;
  visibilityMode: LineNumberVisibilityMode;
  isVisible: boolean;
}): string => {
  const positionClassName =
    position === 'right'
      ? 'byline-line-numbers-right'
      : 'byline-line-numbers-left';

  const visibilityModeClassName =
    visibilityMode === 'autoHide'
      ? 'byline-line-numbers-auto-hide'
      : 'byline-line-numbers-visible-mode';

  const visibleClassName = isVisible
    ? 'byline-line-numbers-visible'
    : 'byline-line-numbers-hidden';

  return `${positionClassName} ${visibilityModeClassName} ${visibleClassName}`;
};

export const getLineNumberEdgeTriggerClassName = ({
  position,
}: {
  position: LineNumberPosition;
}): string => {
  return position === 'right'
    ? `absolute inset-y-0 right-0 z-50 ${LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME} ${MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME}`
    : `absolute inset-y-0 left-0 z-50 ${LINE_NUMBER_EDGE_TRIGGER_WIDTH_CLASS_NAME} ${MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME}`;
};
