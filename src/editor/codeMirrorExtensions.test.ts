import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are not included in app tsconfig.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node typings are not included in app tsconfig.
import { resolve } from 'node:path';

import {
  LEFT_LINE_NUMBER_TEXT_NUDGE,
  RIGHT_LINE_NUMBER_TEXT_NUDGE,
} from '../layoutTuning';

const sourceDirectory = resolve(new URL('.', import.meta.url).pathname);
const codeMirrorExtensionsSource = readFileSync(
  resolve(sourceDirectory, './codeMirrorExtensions.ts'),
  'utf8',
);

describe('line number text offsets', () => {
  it('uses tuned left and right line number text offsets', () => {
    expect(LEFT_LINE_NUMBER_TEXT_NUDGE).toBe('0ch');
    expect(RIGHT_LINE_NUMBER_TEXT_NUDGE).toBe('-0.75ch');
  });
});

describe('document change callback payload', () => {
  it('forwards only changes and does not read full document text', () => {
    expect(codeMirrorExtensionsSource).toContain('onDocumentChange({ changes });');
    expect(codeMirrorExtensionsSource).not.toContain('update.state.doc.toString()');
  });

  it('only requests layout updates when line count changes', () => {
    expect(codeMirrorExtensionsSource).toContain(
      'if (update.startState.doc.lines !== update.state.doc.lines)',
    );
  });

  it('does not report selection changes for docChanged typing updates', () => {
    expect(codeMirrorExtensionsSource).toContain(
      'if (update.selectionSet && !update.docChanged)',
    );
  });
});

describe('typing diff styles', () => {
  it('includes typing diff mark and tick styles', () => {
    expect(codeMirrorExtensionsSource).toContain('.byline-typing-diff');
    expect(codeMirrorExtensionsSource).toContain('.byline-typing-diff-added');
    expect(codeMirrorExtensionsSource).toContain('.byline-typing-diff-deleted');
    expect(codeMirrorExtensionsSource).toContain('.byline-typing-diff-tick');
    expect(codeMirrorExtensionsSource).toContain('boxShadow');
    expect(codeMirrorExtensionsSource).toContain('DIFF_TICK_WIDTH_PX');
  });
});
