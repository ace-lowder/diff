import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are not included in app tsconfig.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node typings are not included in app tsconfig.
import { resolve } from 'node:path';

import {
  getCommandLineRemovalEdit,
  getCommandPanelPlacement,
} from './codeMirrorConsoleCommands';

const sourceDirectory = resolve(new URL('.', import.meta.url).pathname);
const codeMirrorConsoleCommandsSource = readFileSync(
  resolve(sourceDirectory, './codeMirrorConsoleCommands.ts'),
  'utf8',
);

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

describe('getCommandLineRemovalEdit', () => {
  it('removes only first-line command text and keeps cursor at line start', () => {
    expect(
      getCommandLineRemovalEdit({
        commandLine: { text: '/count', from: 0, to: 6, number: 1 },
        previousLine: null,
      }),
    ).toEqual({
      from: 0,
      to: 6,
      selectionAnchor: 0,
    });
  });

  it('removes newline and command line when previous line exists', () => {
    expect(
      getCommandLineRemovalEdit({
        previousLine: { text: 'Two', from: 4, to: 7, number: 2 },
        commandLine: { text: '/count', from: 8, to: 14, number: 3 },
      }),
    ).toEqual({
      from: 7,
      to: 14,
      selectionAnchor: 7,
    });
  });

  it('uses previous line end for middle-line command removal', () => {
    expect(
      getCommandLineRemovalEdit({
        previousLine: { text: 'One', from: 0, to: 3, number: 1 },
        commandLine: { text: '/count', from: 4, to: 10, number: 2 },
      }),
    ).toEqual({
      from: 3,
      to: 10,
      selectionAnchor: 3,
    });
  });
});

describe('autocomplete pointer interactions', () => {
  it('includes pointer hover/click selection wiring without enter execution', () => {
    expect(codeMirrorConsoleCommandsSource).toContain('pointerenter');
    expect(codeMirrorConsoleCommandsSource).toContain('this.selectOption(index);');
    expect(codeMirrorConsoleCommandsSource).toContain('pointerdown');
    expect(codeMirrorConsoleCommandsSource).toContain('event.preventDefault();');
    expect(codeMirrorConsoleCommandsSource).toContain('this.completeSelection();');
    expect(codeMirrorConsoleCommandsSource).toContain(
      "panelElement.setAttribute('role', 'listbox')",
    );
    expect(codeMirrorConsoleCommandsSource).toContain(
      "optionElement.setAttribute('role', 'option')",
    );
    expect(codeMirrorConsoleCommandsSource).toContain("'aria-selected'");

    const clickHandlerStart = codeMirrorConsoleCommandsSource.indexOf(
      "optionElement.addEventListener('click'",
    );
    expect(clickHandlerStart).toBeGreaterThanOrEqual(0);

    const clickHandlerEnd = codeMirrorConsoleCommandsSource.indexOf(
      '});',
      clickHandlerStart,
    );
    const clickHandlerSource = codeMirrorConsoleCommandsSource.slice(
      clickHandlerStart,
      clickHandlerEnd,
    );
    expect(clickHandlerSource).not.toContain('executeOrHandleEnter');
  });
});
