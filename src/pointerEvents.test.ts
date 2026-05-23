import { describe, expect, it } from 'vitest';

import {
  MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME,
  shouldRevealAutoHiddenControls,
} from './pointerEvents';

describe('shouldRevealAutoHiddenControls', () => {
  it('returns true for mouse pointers', () => {
    expect(shouldRevealAutoHiddenControls('mouse')).toBe(true);
  });

  it('returns false for touch pointers', () => {
    expect(shouldRevealAutoHiddenControls('touch')).toBe(false);
  });

  it('returns false for pen pointers', () => {
    expect(shouldRevealAutoHiddenControls('pen')).toBe(false);
  });

  it('returns false for empty pointer types', () => {
    expect(shouldRevealAutoHiddenControls('')).toBe(false);
  });
});

describe('MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME', () => {
  it('matches the shared edge trigger class name', () => {
    expect(MOUSE_REVEAL_EDGE_TRIGGER_CLASS_NAME).toBe(
      'byline-mouse-reveal-edge-trigger',
    );
  });
});
