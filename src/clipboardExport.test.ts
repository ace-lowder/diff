import { describe, expect, it } from 'vitest';

import {
  getClipboardFontStyleRangesForLine,
  getClipboardHighlightRangesForLine,
  getClipboardHtml,
  getDraftClipboardHighlightRanges,
  getSelectionClipboardContent,
} from './clipboardExport';

const getHtmlTextContent = (html: string): string => {
  return html
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
};

describe('getClipboardHtml', () => {
  it('escapes plain text html entities', () => {
    const html = getClipboardHtml({
      text: 'A < B & "C"',
      highlightRanges: [],
    });

    expect(html).toContain(
      '<span style="white-space: pre-wrap;">A &lt; B &amp; &quot;C&quot;</span>',
    );
  });

  it('wraps added ranges in green highlight spans', () => {
    const html = getClipboardHtml({
      text: 'one two',
      highlightRanges: [{ type: 'added', from: 4, to: 7 }],
    });

    expect(html).toContain('<span style="background-color: #d9ead3; color: #000000">two</span>');
  });

  it('wraps non-zero deleted ranges in red highlight spans', () => {
    const html = getClipboardHtml({
      text: 'one two',
      highlightRanges: [{ type: 'deleted', from: 4, to: 7 }],
    });

    expect(html).toContain(
      '<span style="background-color: #f4cccc; color: #000000">two</span>',
    );
  });

  it('highlights the character to the right for zero-width deleted ranges', () => {
    const text = 'This is a test';
    const html = getClipboardHtml({
      text,
      highlightRanges: [{ type: 'deleted', from: 9, to: 9 }],
    });

    expect(html).toContain(
      'a<span style="background-color: #f4cccc; color: #000000"> </span>test',
    );
    expect(html).not.toContain('█');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('highlights the previous character for zero-width deleted ranges at the end', () => {
    const text = 'abc';
    const html = getClipboardHtml({
      text,
      highlightRanges: [{ type: 'deleted', from: text.length, to: text.length }],
    });

    expect(html).toContain(
      'ab<span style="background-color: #f4cccc; color: #000000">c</span>',
    );
    expect(html).not.toContain('█');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('does not wrap newlines for zero-width deleted ranges at newline positions', () => {
    const text = 'one\ntwo';
    const html = getClipboardHtml({
      text,
      highlightRanges: [{ type: 'deleted', from: 3, to: 3 }],
    });

    expect(html).toContain(
      '<span style="background-color: #f4cccc; color: #000000">e</span>\n',
    );
    expect(html).not.toContain('<span style="background-color: #f4cccc; color: #000000">\n</span>');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('splits non-zero highlights around newline boundaries', () => {
    const text = 'one\ntwo';
    const html = getClipboardHtml({
      text,
      highlightRanges: [{ type: 'added', from: 0, to: text.length }],
    });

    expect(html).toContain(
      '<span style="background-color: #d9ead3; color: #000000">one</span>\n<span style="background-color: #d9ead3; color: #000000">two</span>',
    );
    expect(html).not.toContain('<span style="background-color: #d9ead3; color: #000000">one\ntwo</span>');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('wraps draft-style deleted ranges without including newlines', () => {
    const text = 'one\ntwo';
    const html = getClipboardHtml({
      text,
      highlightRanges: [{ type: 'deleted', from: 0, to: text.length }],
    });

    expect(html).toContain(
      '<span style="background-color: #f4cccc; color: #000000">one</span>\n<span style="background-color: #f4cccc; color: #000000">two</span>',
    );
    expect(html).not.toContain('<span style="background-color: #f4cccc; color: #000000">one\ntwo</span>');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('skips invalid and backtracking ranges', () => {
    const html = getClipboardHtml({
      text: 'abcdef',
      highlightRanges: [
        { type: 'added', from: 1, to: 3 },
        { type: 'added', from: 2, to: 4 },
        { type: 'deleted', from: -1, to: -1 },
      ],
    });

    expect(html).toContain(
      'a<span style="background-color: #d9ead3; color: #000000">bc</span>def',
    );
    expect(html).not.toContain('<span style="background-color: #f4cccc; color: #000000">d</span>');
  });

  it('emits bold style spans', () => {
    const html = getClipboardHtml({
      text: 'hello',
      highlightRanges: [],
      fontStyleRanges: [{ type: 'bold', from: 0, to: 5 }],
    });

    expect(html).toContain('<span style="white-space: pre-wrap;"><strong>hello</strong></span>');
    expect(getHtmlTextContent(html)).toBe('hello');
  });

  it('emits italic style spans', () => {
    const html = getClipboardHtml({
      text: 'hello',
      highlightRanges: [],
      fontStyleRanges: [{ type: 'italic', from: 0, to: 5 }],
    });

    expect(html).toContain('<em>hello</em>');
    expect(getHtmlTextContent(html)).toBe('hello');
  });

  it('emits underline style spans', () => {
    const html = getClipboardHtml({
      text: 'hello',
      highlightRanges: [],
      fontStyleRanges: [{ type: 'underline', from: 0, to: 5 }],
    });

    expect(html).toContain('<u>hello</u>');
    expect(getHtmlTextContent(html)).toBe('hello');
  });

  it('combines highlight and bold styles into one span', () => {
    const html = getClipboardHtml({
      text: 'hello',
      highlightRanges: [{ type: 'added', from: 0, to: 5 }],
      fontStyleRanges: [{ type: 'bold', from: 0, to: 5 }],
    });

    expect(html).toContain(
      '<span style="background-color: #d9ead3; color: #000000"><strong>hello</strong></span>',
    );
  });

  it('splits font style ranges around newline boundaries', () => {
    const text = 'one\ntwo';
    const html = getClipboardHtml({
      text,
      highlightRanges: [],
      fontStyleRanges: [{ type: 'italic', from: 0, to: text.length }],
    });

    expect(html).toContain(
      '<span style="white-space: pre-wrap;"><em>one</em>\n<em>two</em></span>',
    );
    expect(html).not.toContain('<em>one\ntwo</em>');
    expect(getHtmlTextContent(html)).toBe(text);
  });

  it('preserves tab characters and sets clipboard tab size', () => {
    const html = getClipboardHtml({
      text: 'one\ttwo',
      highlightRanges: [],
    });

    expect(html).toContain('<span style="white-space: pre-wrap;">');
    expect(getHtmlTextContent(html)).toBe('one\ttwo');
    expect(html).not.toContain('font-family');
    expect(html).not.toContain('font-size');
    expect(html).not.toContain('line-height');
    expect(html).not.toContain('letter-spacing');
    expect(html).not.toContain('tab-size');
  });
});

describe('getDraftClipboardHighlightRanges', () => {
  it('returns no ranges when there are no highlights', () => {
    const text = 'one two';
    const ranges = getDraftClipboardHighlightRanges({
      text,
      highlightRanges: [],
    });
    const html = getClipboardHtml({ text, highlightRanges: ranges });

    expect(ranges).toEqual([]);
    expect(html).not.toContain('#f4cccc');
  });

  it('returns one deleted range for one deleted word', () => {
    const text = 'one two three';
    const ranges = getDraftClipboardHighlightRanges({
      text,
      highlightRanges: [{ type: 'deleted', from: 4, to: 7 }],
    });
    const html = getClipboardHtml({ text, highlightRanges: ranges });

    expect(ranges).toEqual([{ type: 'deleted', from: 4, to: 7 }]);
    expect(html).toContain(
      'one <span style="background-color: #f4cccc; color: #000000">two</span> three',
    );
  });

  it('splits deleted ranges across whitespace and newlines', () => {
    const text = 'one two\nthree';
    const ranges = getDraftClipboardHighlightRanges({
      text,
      highlightRanges: [{ type: 'deleted', from: 0, to: text.length }],
    });

    expect(ranges).toEqual([
      { type: 'deleted', from: 0, to: 3 },
      { type: 'deleted', from: 4, to: 7 },
      { type: 'deleted', from: 8, to: 13 },
    ]);
    expect(ranges.some((range) => text.slice(range.from, range.to).includes(' '))).toBe(
      false,
    );
    expect(
      ranges.some((range) => text.slice(range.from, range.to).includes('\n')),
    ).toBe(false);
  });

  it('does not include unchanged text outside the deleted range', () => {
    const text = 'before deleted after';
    const ranges = getDraftClipboardHighlightRanges({
      text,
      highlightRanges: [{ type: 'deleted', from: 7, to: 14 }],
    });
    const html = getClipboardHtml({ text, highlightRanges: ranges });

    expect(ranges).toEqual([{ type: 'deleted', from: 7, to: 14 }]);
    expect(html).toContain(
      'before <span style="background-color: #f4cccc; color: #000000">deleted</span> after',
    );
    expect(html).not.toContain(
      '<span style="background-color: #f4cccc; color: #000000">before</span>',
    );
    expect(html).not.toContain(
      '<span style="background-color: #f4cccc; color: #000000">after</span>',
    );
  });

  it('preserves text content after highlighting', () => {
    const text = 'one two\nthree';
    const ranges = getDraftClipboardHighlightRanges({
      text,
      highlightRanges: [{ type: 'deleted', from: 0, to: text.length }],
    });
    const html = getClipboardHtml({ text, highlightRanges: ranges });

    expect(getHtmlTextContent(html)).toBe(text);
  });
});

describe('getSelectionClipboardContent', () => {
  it('exports a single clipped selection with font styles', () => {
    const content = getSelectionClipboardContent({
      text: 'abcd efgh',
      selections: [{ from: 1, to: 6 }],
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 4 },
        { type: 'italic', from: 2, to: 7 },
        { type: 'underline', from: 4, to: 8 },
      ],
    });

    expect(content?.plainText).toBe('bcd e');
    expect(content?.htmlText).toContain(
      '<strong>b</strong>',
    );
    expect(content?.htmlText).toContain(
      '<strong><em>cd</em></strong>',
    );
    expect(content?.htmlText).toContain(
      '<em><u> e</u></em>',
    );
    expect(content?.htmlText).toContain('<span style="white-space: pre-wrap;">');
  });

  it('exports multiple selections in document order with joined text', () => {
    const content = getSelectionClipboardContent({
      text: 'alpha beta gamma',
      selections: [
        { from: 6, to: 10 },
        { from: 0, to: 5 },
      ],
      fontStyleRanges: [
        { type: 'bold', from: 0, to: 5 },
        { type: 'italic', from: 6, to: 10 },
        { type: 'underline', from: 0, to: 10 },
      ],
    });

    expect(content?.plainText).toBe('alpha\nbeta');
    expect(content?.htmlText).toContain(
      '<strong><u>alpha</u></strong>',
    );
    expect(content?.htmlText).toContain('\n');
    expect(content?.htmlText).toContain(
      '<em><u>beta</u></em>',
    );
    expect(content?.htmlText).toContain('<span style="white-space: pre-wrap;">');
  });

  it('returns null when there are no non-empty selections', () => {
    expect(
      getSelectionClipboardContent({
        text: 'abc',
        selections: [{ from: 1, to: 1 }],
      }),
    ).toBeNull();
  });
});

describe('getClipboardHighlightRangesForLine', () => {
  it('clips and shifts a non-zero added range', () => {
    const text = 'one\ntwo three\nfour';
    const lineFrom = 4;
    const lineTo = 13;

    expect(
      getClipboardHighlightRangesForLine({
        lineFrom,
        lineTo,
        highlightRanges: [{ type: 'added', from: 6, to: 15 }],
      }),
    ).toEqual([{ type: 'added', from: 2, to: 9 }]);
    expect(text.slice(lineFrom, lineTo)).toBe('two three');
  });

  it('skips non-overlapping highlight ranges', () => {
    expect(
      getClipboardHighlightRangesForLine({
        lineFrom: 4,
        lineTo: 13,
        highlightRanges: [{ type: 'deleted', from: 0, to: 3 }],
      }),
    ).toEqual([]);
  });

  it('includes and shifts a zero-width deleted range at the line end', () => {
    expect(
      getClipboardHighlightRangesForLine({
        lineFrom: 4,
        lineTo: 13,
        highlightRanges: [{ type: 'deleted', from: 13, to: 13 }],
      }),
    ).toEqual([{ type: 'deleted', from: 9, to: 9 }]);
  });

  it('highlights the previous character for shifted end-of-line deleted range', () => {
    const lineText = 'two three';
    const html = getClipboardHtml({
      text: lineText,
      highlightRanges: [{ type: 'deleted', from: lineText.length, to: lineText.length }],
    });

    expect(html).toContain(
      'two thre<span style="background-color: #f4cccc; color: #000000">e</span>',
    );
  });
});

describe('getClipboardFontStyleRangesForLine', () => {
  it('clips and shifts a font style range', () => {
    expect(
      getClipboardFontStyleRangesForLine({
        lineFrom: 4,
        lineTo: 13,
        fontStyleRanges: [{ type: 'bold', from: 6, to: 15 }],
      }),
    ).toEqual([{ type: 'bold', from: 2, to: 9 }]);
  });

  it('skips non-overlapping font style ranges', () => {
    expect(
      getClipboardFontStyleRangesForLine({
        lineFrom: 4,
        lineTo: 13,
        fontStyleRanges: [{ type: 'italic', from: 0, to: 3 }],
      }),
    ).toEqual([]);
  });
});
