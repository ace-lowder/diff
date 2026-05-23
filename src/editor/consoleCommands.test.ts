import { describe, expect, it } from 'vitest';

import {
  getCompletedConsoleCommandLine,
  getConsoleCommandMenu,
  getConsoleCommandPrediction,
  getNoLineAboveCommandLineText,
  getUnknownCommandLineText,
  parseConsoleCommandLine,
} from './consoleCommands';

describe('parseConsoleCommandLine', () => {
  it('parses valid commands', () => {
    expect(parseConsoleCommandLine('/view')).toEqual({
      kind: 'valid',
      command: { type: 'view', mode: 'next' },
    });
    expect(parseConsoleCommandLine('/view draft')).toEqual({
      kind: 'valid',
      command: { type: 'view', mode: 'draft' },
    });
    expect(parseConsoleCommandLine('/view editor')).toEqual({
      kind: 'valid',
      command: { type: 'view', mode: 'editor' },
    });
    expect(parseConsoleCommandLine('/view split')).toEqual({
      kind: 'valid',
      command: { type: 'view', mode: 'split' },
    });
    expect(parseConsoleCommandLine('/copy')).toEqual({
      kind: 'valid',
      command: { type: 'copy', target: 'document' },
    });
    expect(parseConsoleCommandLine('/copy line')).toEqual({
      kind: 'valid',
      command: { type: 'copy', target: 'line' },
    });
    expect(parseConsoleCommandLine('/count')).toEqual({
      kind: 'valid',
      command: { type: 'count', statsMode: 'toggle' },
    });
    expect(parseConsoleCommandLine('/count word')).toEqual({
      kind: 'valid',
      command: { type: 'count', statsMode: 'words' },
    });
    expect(parseConsoleCommandLine('/count char')).toEqual({
      kind: 'valid',
      command: { type: 'count', statsMode: 'characters' },
    });
    expect(parseConsoleCommandLine('/menu hide')).toEqual({
      kind: 'valid',
      command: { type: 'menu', action: 'visibility', visibilityMode: 'autoHide' },
    });
    expect(parseConsoleCommandLine('/menu show')).toEqual({
      kind: 'valid',
      command: { type: 'menu', action: 'visibility', visibilityMode: 'visible' },
    });
    expect(parseConsoleCommandLine('/menu top')).toEqual({
      kind: 'valid',
      command: { type: 'menu', action: 'placement', placement: 'top' },
    });
    expect(parseConsoleCommandLine('/menu bottom')).toEqual({
      kind: 'valid',
      command: { type: 'menu', action: 'placement', placement: 'bottom' },
    });
    expect(parseConsoleCommandLine('/linenums left')).toEqual({
      kind: 'valid',
      command: { type: 'lineNumbers', action: 'position', position: 'left' },
    });
    expect(parseConsoleCommandLine('/linenums right')).toEqual({
      kind: 'valid',
      command: { type: 'lineNumbers', action: 'position', position: 'right' },
    });
    expect(parseConsoleCommandLine('/linenums show')).toEqual({
      kind: 'valid',
      command: { type: 'lineNumbers', action: 'visibility', visibilityMode: 'visible' },
    });
    expect(parseConsoleCommandLine('/linenums hide')).toEqual({
      kind: 'valid',
      command: { type: 'lineNumbers', action: 'visibility', visibilityMode: 'autoHide' },
    });
    expect(parseConsoleCommandLine('/fontsize small')).toEqual({
      kind: 'valid',
      command: { type: 'fontSize', fontSizeMode: 'small' },
    });
    expect(parseConsoleCommandLine('/fontsize medium')).toEqual({
      kind: 'valid',
      command: { type: 'fontSize', fontSizeMode: 'medium' },
    });
    expect(parseConsoleCommandLine('/fontsize large')).toEqual({
      kind: 'valid',
      command: { type: 'fontSize', fontSizeMode: 'large' },
    });
  });

  it('parses invalid and non-command lines', () => {
    expect(parseConsoleCommandLine('/test')).toEqual({ kind: 'unknown-root' });
    expect(parseConsoleCommandLine('/view draf')).toEqual({
      kind: 'unknown-command',
      message: '/view draf - unknown command',
    });
    expect(parseConsoleCommandLine('/count nope')).toEqual({
      kind: 'unknown-command',
      message: '/count nope - unknown command',
    });
    expect(parseConsoleCommandLine('/menu')).toEqual({
      kind: 'unknown-command',
      message: '/menu - unknown command',
    });
    expect(parseConsoleCommandLine('/menu test')).toEqual({
      kind: 'unknown-command',
      message: '/menu test - unknown command',
    });
    expect(parseConsoleCommandLine('/linenums')).toEqual({
      kind: 'unknown-command',
      message: '/linenums - unknown command',
    });
    expect(parseConsoleCommandLine('/fontsize')).toEqual({
      kind: 'unknown-command',
      message: '/fontsize - unknown command',
    });
    expect(parseConsoleCommandLine('/fontsize huge')).toEqual({
      kind: 'unknown-command',
      message: '/fontsize huge - unknown command',
    });
    expect(parseConsoleCommandLine('/linenum show')).toEqual({
      kind: 'unknown-root',
    });
    expect(parseConsoleCommandLine('text /view')).toEqual({ kind: 'not-command' });
  });
});

describe('getUnknownCommandLineText', () => {
  it('trims trailing spaces before appending unknown suffix', () => {
    expect(getUnknownCommandLineText('/view draf   ')).toBe(
      '/view draf - unknown command',
    );
  });
});

describe('getNoLineAboveCommandLineText', () => {
  it('trims trailing spaces before appending no-line-above suffix', () => {
    expect(getNoLineAboveCommandLineText('/copy line   ')).toBe(
      '/copy line - no line above to copy',
    );
  });
});

describe('getConsoleCommandMenu', () => {
  it('returns root options', () => {
    expect(getConsoleCommandMenu({ lineText: '/', cursorOffset: 1 })).toEqual({
      options: [
        { label: 'view' },
        { label: 'copy' },
        { label: 'count' },
        { label: 'menu' },
        { label: 'linenums' },
        { label: 'fontsize' },
      ],
      tokenFrom: 1,
      tokenTo: 1,
    });
  });

  it('filters root options by prefix', () => {
    expect(getConsoleCommandMenu({ lineText: '/v', cursorOffset: 2 })).toEqual({
      options: [{ label: 'view' }],
      tokenFrom: 1,
      tokenTo: 2,
    });

    expect(getConsoleCommandMenu({ lineText: '/c', cursorOffset: 2 })).toEqual({
      options: [{ label: 'copy' }, { label: 'count' }],
      tokenFrom: 1,
      tokenTo: 2,
    });

    expect(getConsoleCommandMenu({ lineText: '/m', cursorOffset: 2 })).toEqual({
      options: [{ label: 'menu' }],
      tokenFrom: 1,
      tokenTo: 2,
    });

    expect(getConsoleCommandMenu({ lineText: '/li', cursorOffset: 3 })).toEqual({
      options: [{ label: 'linenums' }],
      tokenFrom: 1,
      tokenTo: 3,
    });

    expect(getConsoleCommandMenu({ lineText: '/font', cursorOffset: 5 })).toEqual({
      options: [{ label: 'fontsize' }],
      tokenFrom: 1,
      tokenTo: 5,
    });
  });

  it('returns option menus by root command', () => {
    expect(getConsoleCommandMenu({ lineText: '/view ', cursorOffset: 6 })).toEqual({
      options: [{ label: 'draft' }, { label: 'editor' }, { label: 'split' }],
      tokenFrom: 6,
      tokenTo: 6,
    });

    expect(getConsoleCommandMenu({ lineText: '/view d', cursorOffset: 7 })).toEqual({
      options: [{ label: 'draft' }],
      tokenFrom: 6,
      tokenTo: 7,
    });

    expect(getConsoleCommandMenu({ lineText: '/copy ', cursorOffset: 6 })).toEqual({
      options: [{ label: 'line' }],
      tokenFrom: 6,
      tokenTo: 6,
    });

    expect(getConsoleCommandMenu({ lineText: '/count ', cursorOffset: 7 })).toEqual({
      options: [{ label: 'word' }, { label: 'char' }],
      tokenFrom: 7,
      tokenTo: 7,
    });

    expect(getConsoleCommandMenu({ lineText: '/count c', cursorOffset: 8 })).toEqual({
      options: [{ label: 'char' }],
      tokenFrom: 7,
      tokenTo: 8,
    });

    expect(getConsoleCommandMenu({ lineText: '/menu ', cursorOffset: 6 })).toEqual({
      options: [{ label: 'hide' }, { label: 'show' }, { label: 'top' }, { label: 'bottom' }],
      tokenFrom: 6,
      tokenTo: 6,
    });

    expect(getConsoleCommandMenu({ lineText: '/menu h', cursorOffset: 7 })).toEqual({
      options: [{ label: 'hide' }],
      tokenFrom: 6,
      tokenTo: 7,
    });

    expect(getConsoleCommandMenu({ lineText: '/menu b', cursorOffset: 7 })).toEqual({
      options: [{ label: 'bottom' }],
      tokenFrom: 6,
      tokenTo: 7,
    });

    expect(getConsoleCommandMenu({ lineText: '/linenums ', cursorOffset: 10 })).toEqual({
      options: [{ label: 'left' }, { label: 'right' }, { label: 'show' }, { label: 'hide' }],
      tokenFrom: 10,
      tokenTo: 10,
    });

    expect(getConsoleCommandMenu({ lineText: '/linenums r', cursorOffset: 11 })).toEqual({
      options: [{ label: 'right' }],
      tokenFrom: 10,
      tokenTo: 11,
    });

    expect(getConsoleCommandMenu({ lineText: '/linenums h', cursorOffset: 11 })).toEqual({
      options: [{ label: 'hide' }],
      tokenFrom: 10,
      tokenTo: 11,
    });

    expect(getConsoleCommandMenu({ lineText: '/fontsize ', cursorOffset: 10 })).toEqual({
      options: [{ label: 'small' }, { label: 'medium' }, { label: 'large' }],
      tokenFrom: 10,
      tokenTo: 10,
    });

    expect(getConsoleCommandMenu({ lineText: '/fontsize m', cursorOffset: 11 })).toEqual({
      options: [{ label: 'medium' }],
      tokenFrom: 10,
      tokenTo: 11,
    });
  });

  it('does not show menu for complete subcommands', () => {
    expect(getConsoleCommandMenu({ lineText: '/view draft', cursorOffset: 11 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/count', cursorOffset: 6 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/menu hide', cursorOffset: 10 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/menu show', cursorOffset: 10 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/menu top', cursorOffset: 9 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/menu bottom', cursorOffset: 12 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/fontsize medium', cursorOffset: 16 })).toBeNull();
  });
});

describe('getCompletedConsoleCommandLine', () => {
  it('completes the selected token', () => {
    expect(
      getCompletedConsoleCommandLine({
        lineText: '/v',
        cursorOffset: 2,
        selectedLabel: 'view',
      }),
    ).toBe('/view');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/view d',
        cursorOffset: 7,
        selectedLabel: 'draft',
      }),
    ).toBe('/view draft');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/count c',
        cursorOffset: 8,
        selectedLabel: 'char',
      }),
    ).toBe('/count char');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/menu h',
        cursorOffset: 7,
        selectedLabel: 'hide',
      }),
    ).toBe('/menu hide');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/linenums r',
        cursorOffset: 11,
        selectedLabel: 'right',
      }),
    ).toBe('/linenums right');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/linenums h',
        cursorOffset: 11,
        selectedLabel: 'hide',
      }),
    ).toBe('/linenums hide');

    expect(
      getCompletedConsoleCommandLine({
        lineText: '/fontsize m',
        cursorOffset: 11,
        selectedLabel: 'medium',
      }),
    ).toBe('/fontsize medium');
  });
});

describe('getConsoleCommandPrediction', () => {
  it('returns only remaining prediction text', () => {
    expect(
      getConsoleCommandPrediction({
        lineText: '/v',
        cursorOffset: 2,
        selectedLabel: 'view',
      }),
    ).toBe('iew');

    expect(
      getConsoleCommandPrediction({
        lineText: '/view d',
        cursorOffset: 7,
        selectedLabel: 'draft',
      }),
    ).toBe('raft');

    expect(
      getConsoleCommandPrediction({
        lineText: '/count char',
        cursorOffset: 11,
        selectedLabel: 'char',
      }),
    ).toBe('');

    expect(
      getConsoleCommandPrediction({
        lineText: '/m',
        cursorOffset: 2,
        selectedLabel: 'menu',
      }),
    ).toBe('enu');

    expect(
      getConsoleCommandPrediction({
        lineText: '/menu h',
        cursorOffset: 7,
        selectedLabel: 'hide',
      }),
    ).toBe('ide');

    expect(
      getConsoleCommandPrediction({
        lineText: '/linenums r',
        cursorOffset: 11,
        selectedLabel: 'right',
      }),
    ).toBe('ight');

    expect(
      getConsoleCommandPrediction({
        lineText: '/linenums h',
        cursorOffset: 11,
        selectedLabel: 'hide',
      }),
    ).toBe('ide');

    expect(
      getConsoleCommandPrediction({
        lineText: '/menu b',
        cursorOffset: 7,
        selectedLabel: 'bottom',
      }),
    ).toBe('ottom');
  });
});
