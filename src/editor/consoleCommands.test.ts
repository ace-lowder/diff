import { describe, expect, it } from 'vitest';

import {
  getCompletedConsoleCommandLine,
  getConsoleCommandMenu,
  getConsoleCommandPrediction,
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
    expect(parseConsoleCommandLine('/count word')).toEqual({
      kind: 'valid',
      command: { type: 'count', statsMode: 'words' },
    });
    expect(parseConsoleCommandLine('/count char')).toEqual({
      kind: 'valid',
      command: { type: 'count', statsMode: 'characters' },
    });
  });

  it('parses invalid and non-command lines', () => {
    expect(parseConsoleCommandLine('/test')).toEqual({ kind: 'unknown-root' });
    expect(parseConsoleCommandLine('/view draf')).toEqual({
      kind: 'unknown-command',
      message: '/view draf - unknown command',
    });
    expect(parseConsoleCommandLine('/count')).toEqual({
      kind: 'unknown-command',
      message: '/count - unknown command',
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

describe('getConsoleCommandMenu', () => {
  it('returns root options', () => {
    expect(getConsoleCommandMenu({ lineText: '/', cursorOffset: 1 })).toEqual({
      options: [{ label: 'view' }, { label: 'copy' }, { label: 'count' }],
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

    expect(getConsoleCommandMenu({ lineText: '/count c', cursorOffset: 8 })).toEqual({
      options: [{ label: 'char' }],
      tokenFrom: 7,
      tokenTo: 8,
    });
  });

  it('does not show menu for complete subcommands', () => {
    expect(getConsoleCommandMenu({ lineText: '/view draft', cursorOffset: 11 })).toBeNull();
    expect(getConsoleCommandMenu({ lineText: '/count', cursorOffset: 6 })).toBeNull();
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
  });
});
