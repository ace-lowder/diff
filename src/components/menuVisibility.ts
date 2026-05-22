export type MenuVisibilityMode = 'visible' | 'autoHide';

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
