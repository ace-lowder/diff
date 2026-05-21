import { describe, expect, it } from 'vitest';

import { getCommandPanelPlacement } from './codeMirrorConsoleCommands';

describe('getCommandPanelPlacement', () => {
  it('places panel below cursor when there is room', () => {
    const placement = getCommandPanelPlacement({
      cursorLeft: 120,
      cursorTop: 200,
      cursorBottom: 224,
      editorLeft: 100,
      editorTop: 100,
      viewportHeight: 900,
      optionCount: 3,
    });

    expect(placement).toEqual({
      left: 20,
      top: 128,
    });
  });

  it('places panel above cursor when panel would overflow viewport bottom', () => {
    const placement = getCommandPanelPlacement({
      cursorLeft: 300,
      cursorTop: 760,
      cursorBottom: 784,
      editorLeft: 280,
      editorTop: 120,
      viewportHeight: 820,
      optionCount: 3,
    });

    expect(placement).toEqual({
      left: 20,
      top: 556,
    });
  });

  it('clamps negative left and top to zero', () => {
    const placement = getCommandPanelPlacement({
      cursorLeft: 40,
      cursorTop: 20,
      cursorBottom: 24,
      editorLeft: 80,
      editorTop: 40,
      viewportHeight: 40,
      optionCount: 3,
    });

    expect(placement.left).toBe(0);
    expect(placement.top).toBe(0);
  });

  it('accounts for option count in placement', () => {
    const shortPlacement = getCommandPanelPlacement({
      cursorLeft: 180,
      cursorTop: 560,
      cursorBottom: 584,
      editorLeft: 100,
      editorTop: 100,
      viewportHeight: 700,
      optionCount: 1,
    });
    const tallPlacement = getCommandPanelPlacement({
      cursorLeft: 180,
      cursorTop: 560,
      cursorBottom: 584,
      editorLeft: 100,
      editorTop: 100,
      viewportHeight: 700,
      optionCount: 6,
    });

    expect(shortPlacement.top).toBe(488);
    expect(tallPlacement.top).toBe(304);
  });
});
