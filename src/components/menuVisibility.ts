export type MenuVisibilityMode = 'visible' | 'autoHide';

export const getMenuLayoutClassName = ({
  visibilityMode,
}: {
  visibilityMode: MenuVisibilityMode;
}): string => {
  if (visibilityMode === 'autoHide') {
    return 'fixed left-0 right-0 top-0 sm:bottom-0 sm:top-auto';
  }

  return 'relative order-first sm:order-last';
};

export const getMenuVisibilityClassName = ({
  visibilityMode,
  isVisible,
}: {
  visibilityMode: MenuVisibilityMode;
  isVisible: boolean;
}): string => {
  if (visibilityMode === 'visible' || isVisible) {
    return 'translate-y-0';
  }

  return '-translate-y-full sm:translate-y-full';
};
