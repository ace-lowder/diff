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

describe('typing diff styles', () => {
  it('includes typing diff mark styles', () => {
    expect(codeMirrorExtensionsSource).toContain('.diff-typing-diff');
    expect(codeMirrorExtensionsSource).toContain('.diff-typing-diff-added');
    expect(codeMirrorExtensionsSource).toContain('.diff-typing-diff-deleted');
    expect(codeMirrorExtensionsSource).toContain(
      'paddingTop: `${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'paddingBottom: `${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'marginTop: `-${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'marginBottom: `-${TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX}px`',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'boxShadow: `0 0 0 ${TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX}px #2A4C2C`',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'boxShadow: `0 0 0 ${TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX}px #693330`',
    );
    expect(codeMirrorExtensionsSource).not.toContain(
      '0 0 0 1px #2A4C2C, 0 -1px 0 0 #2A4C2C, 0 1px 0 0 #2A4C2C',
    );
    expect(codeMirrorExtensionsSource).not.toContain(
      '0 0 0 1px #693330, 0 -1px 0 0 #693330, 0 1px 0 0 #693330',
    );
    expect(codeMirrorExtensionsSource).not.toContain(
      'boxShadow: "0 0 0 2px #2A4C2C"',
    );
    expect(codeMirrorExtensionsSource).not.toContain(
      'boxShadow: "0 0 0 2px #693330"',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'TYPING_DIFF_HIGHLIGHT_VERTICAL_PADDING_PX',
    );
    expect(codeMirrorExtensionsSource).toContain(
      'TYPING_DIFF_HIGHLIGHT_HORIZONTAL_SPREAD_PX',
    );
    expect(codeMirrorExtensionsSource).not.toContain('.diff-typing-diff-tick');
    expect(codeMirrorExtensionsSource).not.toContain('DIFF_TICK_WIDTH_PX');
  });
});
