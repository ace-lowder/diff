import type { MenuPlacement, MenuVisibilityMode } from '../appTypes';
import { MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME } from '../pointerEvents';

export const getMenuLayoutClassName = ({
  visibilityMode,
  placement,
}: {
  visibilityMode: MenuVisibilityMode;
  placement: MenuPlacement;
}): string => {
  if (visibilityMode === 'autoHide') {
    if (placement === 'top') {
      return 'fixed left-0 right-0 top-0';
    }

    if (placement === 'bottom') {
      return 'fixed bottom-0 left-0 right-0';
    }

    return 'fixed left-0 right-0 top-0 sm:bottom-0 sm:top-auto';
  }

  if (placement === 'top') {
    return 'relative order-first';
  }

  if (placement === 'bottom') {
    return 'relative order-last';
  }

  return 'relative order-first sm:order-last';
};

export const getMenuVisibilityClassName = ({
  visibilityMode,
  isVisible,
  placement,
}: {
  visibilityMode: MenuVisibilityMode;
  isVisible: boolean;
  placement: MenuPlacement;
}): string => {
  if (visibilityMode === 'visible' || isVisible) {
    return 'translate-y-0';
  }

  if (placement === 'top') {
    return '-translate-y-full';
  }

  if (placement === 'bottom') {
    return 'translate-y-full';
  }

  return '-translate-y-full sm:translate-y-full';
};

export const getMenuEdgeTriggerClassName = ({
  placement,
}: {
  placement: MenuPlacement;
}): string => {
  if (placement === 'top') {
    return `fixed left-0 top-0 z-40 h-3 w-full ${MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME}`;
  }

  if (placement === 'bottom') {
    return `fixed bottom-0 left-0 z-40 h-3 w-full ${MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME}`;
  }

  return `fixed left-0 top-0 z-40 h-3 w-full sm:bottom-0 sm:top-auto ${MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME}`;
};

export const getMenuBorderClassName = ({
  placement,
}: {
  placement: MenuPlacement;
}): string => {
  if (placement === 'top') {
    return 'border-b';
  }

  if (placement === 'bottom') {
    return 'border-t';
  }

  return 'border-b sm:border-b-0 sm:border-t';
};
