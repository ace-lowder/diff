import { describe, expect, it } from 'vitest';

import {
  EXAMPLE_DRAFT_TEXT,
  EXAMPLE_EDITOR_TEXT,
  getExampleCommandPlacement,
} from './exampleDocument';
import { DEFAULT_DRAFT_TEXT, DEFAULT_EDITOR_TEXT } from './storage';

describe('getExampleCommandPlacement', () => {
  it('puts the unused command first for blank panes', () => {
    expect(
      getExampleCommandPlacement({
        documentText: { draftText: '', editorText: ' \n' },
        hasUsedExample: false,
      }),
    ).toBe('first');
  });

  it('treats an in-progress command in otherwise blank panes as blank', () => {
    expect(
      getExampleCommandPlacement({
        documentText: { draftText: '\n/exa', editorText: '' },
        hasUsedExample: false,
      }),
    ).toBe('first');
  });

  it('ignores whitespace when comparing starter text', () => {
    expect(
      getExampleCommandPlacement({
        documentText: {
          draftText: DEFAULT_DRAFT_TEXT.replaceAll('\n', '\n\n'),
          editorText: DEFAULT_EDITOR_TEXT.replaceAll(' ', '  '),
        },
        hasUsedExample: false,
      }),
    ).toBe('first');
  });

  it('keeps the used command last while the example remains', () => {
    expect(
      getExampleCommandPlacement({
        documentText: {
          draftText: EXAMPLE_DRAFT_TEXT,
          editorText: `${EXAMPLE_EDITOR_TEXT}\n\n`,
        },
        hasUsedExample: true,
      }),
    ).toBe('last');
  });

  it('puts the command last when starter text returns after use', () => {
    expect(
      getExampleCommandPlacement({
        documentText: {
          draftText: DEFAULT_DRAFT_TEXT,
          editorText: DEFAULT_EDITOR_TEXT,
        },
        hasUsedExample: true,
      }),
    ).toBe('last');
  });

  it('hides the command when either pane has substantially changed', () => {
    expect(
      getExampleCommandPlacement({
        documentText: {
          draftText: 'A real draft with unrelated writing.',
          editorText: DEFAULT_EDITOR_TEXT,
        },
        hasUsedExample: false,
      }),
    ).toBeNull();
  });
});
