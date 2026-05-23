import { describe, expect, it } from 'vitest';

import { shouldRevealAutoHiddenControls } from './pointerEvents';

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
