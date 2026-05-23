export const MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME =
  'byline-mouse-reveal-edge-trigger';

export const shouldRevealAutoHiddenControls = (pointerType: string): boolean => {
  return pointerType === 'mouse';
};
