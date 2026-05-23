import type {
  LineNumberPosition,
  LineNumberVisibilityMode,
} from '../appTypes';

export const LINE_NUMBER_AUTO_HIDE_DELAY_MS = 2000;

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
    ? 'absolute inset-y-0 right-0 z-30 w-3'
    : 'absolute inset-y-0 left-0 z-30 w-3';
};
