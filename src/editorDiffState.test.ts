import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are not included in app tsconfig.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node typings are not included in app tsconfig.
import { resolve } from 'node:path';

import {
  getLineAnchoredDiffResult,
} from './editorDiff';
import { getEditorDiffState } from './editorDiffState';

const sourceDirectory = resolve(new URL('.', import.meta.url).pathname);
const editorDiffStateSource = readFileSync(
  resolve(sourceDirectory, './editorDiffState.ts'),
  'utf8',
);

describe('getEditorDiffState', () => {
  it('matches direct helper outputs', () => {
    const draftText = 'One line\nSecond line';
    const editorText = 'One revised line\nSecond line';

    expect(getEditorDiffState({ draftText, editorText })).toEqual(
      getLineAnchoredDiffResult({ draftText, editorText }),
    );
  });

  it('does not call global display-change diff in editor diff state module', () => {
    expect(editorDiffStateSource).not.toContain('getDisplayChanges(');
  });
});
