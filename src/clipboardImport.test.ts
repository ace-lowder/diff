import { describe, expect, it } from 'vitest';

import { getClipboardHtml } from './clipboardExport';
import { getRichTextClipboardContent } from './clipboardImport';

describe('getRichTextClipboardContent', () => {
  it('parses StartFragment html with wrapper whitespace, nbsp, and zero-width characters', () => {
    expect(
      getRichTextClipboardContent({
        html:
          '<html><body>\n<!--StartFragment-->\n<div><strong>Hel&nbsp;lo</strong>\u200B<br><em>Wo&#114;ld</em></div>\n<!--EndFragment-->\n</body></html>',
        plainText: 'Hel lo\nWorld',
      }),
    ).toEqual({
      text: 'Hel lo\nWorld',
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 6 },
        { type: 'italic', from: 7, to: 12 },
      ],
    });
  });

  it('parses semantic tags into font style ranges', () => {
    expect(
      getRichTextClipboardContent({
        html: '<div><strong>bo<i>ld</i></strong> <em>it</em> <u>un</u></div>',
        plainText: 'bold it un',
      }),
    ).toEqual({
      text: 'bold it un',
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 4 },
        { type: 'italic', from: 2, to: 4 },
        { type: 'italic', from: 5, to: 7 },
        { type: 'underline', from: 8, to: 10 },
      ],
    });
  });

  it('handles nested inline styles and overrides', () => {
    expect(
      getRichTextClipboardContent({
        html:
          '<strong>a<span style="font-weight: normal">b</span><u>c<span style="text-decoration: none">d</span>e</u></strong>',
        plainText: 'abcde',
      }),
    ).toEqual({
      text: 'abcde',
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 1 },
        { type: 'bold', from: 2, to: 5 },
        { type: 'underline', from: 2, to: 3 },
        { type: 'underline', from: 4, to: 5 },
      ],
    });
  });

  it('decodes entities and line breaks', () => {
    expect(
      getRichTextClipboardContent({
        html: '<div>Hello &amp; <strong>world</strong><br>next&#10;line</div>',
        plainText: 'Hello & world\nnext\nline',
      }),
    ).toEqual({
      text: 'Hello & world\nnext\nline',
      fontStyleRanges: [{ type: 'bold', from: 8, to: 13 }],
    });
  });

  it('round trips Byline clipboard html', () => {
    const html = getClipboardHtml({
      text: 'alpha\nbeta',
      highlightRanges: [],
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 5 },
        { type: 'italic', from: 6, to: 10 },
        { type: 'underline', from: 0, to: 10 },
      ],
    });

    expect(
      getRichTextClipboardContent({
        html,
        plainText: 'alpha\nbeta',
      }),
    ).toEqual({
      text: 'alpha\nbeta',
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 5 },
        { type: 'italic', from: 6, to: 10 },
        { type: 'underline', from: 0, to: 5 },
        { type: 'underline', from: 6, to: 10 },
      ],
    });
  });

  it('returns null for plain or mismatched HTML', () => {
    expect(
      getRichTextClipboardContent({
        html: '<div>plain</div>',
        plainText: 'plain',
      }),
    ).toBeNull();

    expect(
      getRichTextClipboardContent({
        html:
          '<!--StartFragment--><div>ab<strong>cd</strong>ef</div><!--EndFragment-->',
        plainText: 'abXdef',
      }),
    ).toBeNull();
  });
});
