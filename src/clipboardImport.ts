import { normalizeFontStyleRanges, type FontStyleRange } from './fontStyles';

export type RichTextClipboardContent = {
  text: string;
  fontStyleRanges: FontStyleRange[];
};

type StyleState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type StyleDelta = Partial<StyleState>;

type TagInfo = {
  tagName: string;
  attributes: Record<string, string>;
  isClosing: boolean;
  isSelfClosing: boolean;
};

const BLOCK_TAG_NAMES = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'div',
  'dd',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const IGNORED_TAG_NAMES = new Set(['head', 'script', 'style', 'svg']);

const VOID_TAG_NAMES = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const ENTITY_REPLACEMENTS: Record<string, string> = {
  amp: '&',
  apos: "'",
  cent: '¢',
  copy: '©',
  deg: '°',
  divide: '÷',
  ensp: '\u2002',
  emsp: '\u2003',
  euro: '€',
  gt: '>',
  hellip: '…',
  laquo: '«',
  lt: '<',
  mdash: '—',
  nbsp: '\u00A0',
  ndash: '–',
  para: '¶',
  pound: '£',
  quot: '"',
  raquo: '»',
  reg: '®',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  sect: '§',
  shy: '\u00AD',
  thinsp: '\u2009',
  trade: '™',
  uarr: '↑',
  darr: '↓',
  larr: '←',
  rarr: '→',
  plusmn: '±',
  times: '×',
  micro: 'µ',
  bull: '•',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  yen: '¥',
  section: '§',
};

export const getRichTextClipboardContent = ({
  html,
  plainText,
}: {
  html: string;
  plainText: string;
}): RichTextClipboardContent | null => {
  const parsed = parseHtmlClipboardContent(extractClipboardFragmentHtml(html));

  if (!parsed) {
    return null;
  }

  const normalizedPlainText = normalizeClipboardText(plainText);
  const normalizedParsedText = normalizeClipboardText(parsed.text);

  const textMap = mapParsedTextToPlainText(
    normalizedParsedText,
    normalizedPlainText,
  );

  if (!textMap) {
    return null;
  }

  const text = normalizedPlainText;
  const fontStyleRanges = normalizeFontStyleRanges(
    parsed.fontStyleRanges
      .map((range) =>
        mapFontStyleRangeThroughTextMap(range, textMap.positionMap),
      )
      .filter((range): range is FontStyleRange => range !== null),
  );

  if (fontStyleRanges.length === 0) {
    return null;
  }

  return {
    text,
    fontStyleRanges,
  };
};

const extractClipboardFragmentHtml = (html: string): string => {
  const startMarker = '<!--StartFragment-->';
  const endMarker = '<!--EndFragment-->';
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return html;
  }

  return html.slice(startIndex + startMarker.length, endIndex);
};

const parseHtmlClipboardContent = (html: string): RichTextClipboardContent | null => {
  let text = '';
  const fontStyleRanges: FontStyleRange[] = [];
  const styleStarts: Record<'bold' | 'italic' | 'underline', number | null> = {
    bold: null,
    italic: null,
    underline: null,
  };
  let currentStyleState: StyleState = {
    bold: false,
    italic: false,
    underline: false,
  };
  const frameStack: Array<{
    tagName: string;
    previousState: StyleState;
    isBlock: boolean;
  }> = [];
  let ignoredTagName: string | null = null;

  const appendText = (value: string) => {
    if (value.length === 0) {
      return;
    }

    text += value;
  };

  const appendLineBreak = () => {
    appendText('\n');
  };

  const appendBlockBoundary = () => {
    if (text.length === 0 || text.endsWith('\n')) {
      return;
    }

    appendLineBreak();
  };

  const syncStyles = (nextState: StyleState) => {
    const previousState = currentStyleState;

    for (const type of ['bold', 'italic', 'underline'] as const) {
      if (previousState[type] && !nextState[type]) {
        const start = styleStarts[type];
        if (start !== null && text.length > start) {
          fontStyleRanges.push({
            type,
            from: start,
            to: text.length,
          });
        }
        styleStarts[type] = null;
      }
    }

    currentStyleState = nextState;

    for (const type of ['bold', 'italic', 'underline'] as const) {
      if (!previousState[type] && nextState[type]) {
        styleStarts[type] = text.length;
      }
    }
  };

  let index = 0;
  while (index < html.length) {
    if (html[index] !== '<') {
      const nextTagIndex = html.indexOf('<', index);
      const rawText =
        nextTagIndex === -1 ? html.slice(index) : html.slice(index, nextTagIndex);
      appendText(decodeHtmlEntities(normalizeClipboardText(rawText)));
      index = nextTagIndex === -1 ? html.length : nextTagIndex;
      continue;
    }

    const tagEndIndex = findTagEndIndex(html, index);
    if (tagEndIndex === -1) {
      appendText(decodeHtmlEntities(normalizeClipboardText(html.slice(index))));
      break;
    }

    const tokenText = html.slice(index + 1, tagEndIndex).trim();
    index = tagEndIndex + 1;

    if (
      tokenText.startsWith('!') &&
      !tokenText.startsWith('!--') &&
      !tokenText.startsWith('![CDATA[')
    ) {
      continue;
    }

    if (tokenText.startsWith('!--')) {
      continue;
    }

    if (tokenText.startsWith('?')) {
      continue;
    }

    const tagInfo = parseTagInfo(tokenText);
    if (!tagInfo) {
      continue;
    }

    const lowerTagName = tagInfo.tagName.toLowerCase();

    if (ignoredTagName !== null) {
      if (tagInfo.isClosing && lowerTagName === ignoredTagName) {
        ignoredTagName = null;
      }
      continue;
    }

    if (tagInfo.isClosing) {
      const frame = frameStack[frameStack.length - 1];
      if (!frame || frame.tagName !== lowerTagName) {
        continue;
      }

      frameStack.pop();
      syncStyles(frame.previousState);

      if (frame.isBlock) {
        appendBlockBoundary();
      }

      continue;
    }

    if (IGNORED_TAG_NAMES.has(lowerTagName)) {
      ignoredTagName = lowerTagName;
      continue;
    }

    if (lowerTagName === 'br') {
      appendLineBreak();
      continue;
    }

    if (lowerTagName === 'hr') {
      appendBlockBoundary();
      continue;
    }

    const nextState = applyStyleDelta(currentStyleState, getStyleDelta(tagInfo));
    const isBlock = BLOCK_TAG_NAMES.has(lowerTagName);

    if (isBlock) {
      appendBlockBoundary();
    }

    frameStack.push({
      tagName: lowerTagName,
      previousState: currentStyleState,
      isBlock,
    });

    syncStyles(nextState);

    if (tagInfo.isSelfClosing || VOID_TAG_NAMES.has(lowerTagName)) {
      const frame = frameStack.pop();
      if (frame) {
        syncStyles(frame.previousState);
      }
    }
  }

  while (frameStack.length > 0) {
    const frame = frameStack.pop();
    if (!frame) {
      continue;
    }

    syncStyles(frame.previousState);
  }

  for (const type of ['bold', 'italic', 'underline'] as const) {
    const start = styleStarts[type];
    if (start !== null && text.length > start) {
      fontStyleRanges.push({
        type,
        from: start,
        to: text.length,
      });
    }
  }

  return {
    text,
    fontStyleRanges,
  };
};

const normalizeClipboardText = (text: string): string => {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B\uFEFF]/g, '');
};

const mapParsedTextToPlainText = (
  parsedText: string,
  plainText: string,
): { positionMap: number[] } | null => {
  const positionMap = new Array<number>(parsedText.length + 1);
  let parsedIndex = 0;
  let plainIndex = 0;
  let hasMatchedContent = false;

  positionMap[0] = 0;

  while (parsedIndex < parsedText.length) {
    const parsedCharacter = parsedText[parsedIndex];
    const plainCharacter = plainText[plainIndex];

    if (
      parsedCharacter === '\n' &&
      !hasMatchedContent &&
      plainCharacter !== '\n'
    ) {
      parsedIndex += 1;
      positionMap[parsedIndex] = plainIndex;
      continue;
    }

    if (parsedCharacter === '\n' && plainIndex === plainText.length) {
      parsedIndex += 1;
      positionMap[parsedIndex] = plainIndex;
      continue;
    }

    if (plainIndex >= plainText.length) {
      return null;
    }

    if (parsedCharacter !== plainCharacter) {
      return null;
    }

    parsedIndex += 1;
    plainIndex += 1;
    positionMap[parsedIndex] = plainIndex;

    if (parsedCharacter !== '\n') {
      hasMatchedContent = true;
    }
  }

  while (plainIndex < plainText.length && plainText[plainIndex] === '\n') {
    plainIndex += 1;
  }

  if (plainIndex !== plainText.length) {
    return null;
  }

  return {
    positionMap,
  };
};

const mapFontStyleRangeThroughTextMap = (
  range: FontStyleRange,
  positionMap: number[],
): FontStyleRange | null => {
  const from = positionMap[range.from];
  const to = positionMap[range.to];

  if (from === undefined || to === undefined || to <= from) {
    return null;
  }

  return {
    ...range,
    from,
    to,
  };
};

const parseTagInfo = (tokenText: string): TagInfo | null => {
  if (tokenText.length === 0) {
    return null;
  }

  let index = 0;
  let isClosing = false;
  if (tokenText[index] === '/') {
    isClosing = true;
    index += 1;
  }

  while (index < tokenText.length && /\s/.test(tokenText[index])) {
    index += 1;
  }

  const tagNameStart = index;
  while (index < tokenText.length && /[^\s/>]/.test(tokenText[index])) {
    index += 1;
  }

  const tagName = tokenText.slice(tagNameStart, index).trim();
  if (tagName.length === 0) {
    return null;
  }

  const attributes = parseAttributes(tokenText.slice(index));
  const isSelfClosing =
    tokenText.endsWith('/') || VOID_TAG_NAMES.has(tagName.toLowerCase());

  return {
    tagName,
    attributes,
    isClosing,
    isSelfClosing,
  };
};

const parseAttributes = (attributeText: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  let index = 0;

  while (index < attributeText.length) {
    while (index < attributeText.length && /\s/.test(attributeText[index])) {
      index += 1;
    }

    if (index >= attributeText.length) {
      break;
    }

    if (attributeText[index] === '/') {
      index += 1;
      continue;
    }

    const nameStart = index;
    while (index < attributeText.length && /[^\s=/>]/.test(attributeText[index])) {
      index += 1;
    }

    const name = attributeText.slice(nameStart, index).toLowerCase();
    if (name.length === 0) {
      index += 1;
      continue;
    }

    while (index < attributeText.length && /\s/.test(attributeText[index])) {
      index += 1;
    }

    let value = '';
    if (attributeText[index] === '=') {
      index += 1;
      while (index < attributeText.length && /\s/.test(attributeText[index])) {
        index += 1;
      }

      if (attributeText[index] === '"' || attributeText[index] === "'") {
        const quote = attributeText[index];
        index += 1;
        const valueStart = index;
        while (index < attributeText.length && attributeText[index] !== quote) {
          index += 1;
        }
        value = attributeText.slice(valueStart, index);
        if (attributeText[index] === quote) {
          index += 1;
        }
      } else {
        const valueStart = index;
        while (index < attributeText.length && /[^\s>]/.test(attributeText[index])) {
          index += 1;
        }
        value = attributeText.slice(valueStart, index);
      }
    }

    attributes[name] = decodeHtmlEntities(value);
  }

  return attributes;
};

const getStyleDelta = (tagInfo: TagInfo): StyleDelta => {
  const delta: StyleDelta = {};
  const lowerTagName = tagInfo.tagName.toLowerCase();

  if (lowerTagName === 'b' || lowerTagName === 'strong') {
    delta.bold = true;
  }

  if (lowerTagName === 'i' || lowerTagName === 'em') {
    delta.italic = true;
  }

  if (lowerTagName === 'u') {
    delta.underline = true;
  }

  const styleAttribute = tagInfo.attributes.style;
  if (!styleAttribute) {
    return delta;
  }

  for (const declaration of styleAttribute.split(';')) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim().toLowerCase();

    if (property === 'font-weight') {
      const weight = getFontWeightStyleOverride(value);
      if (weight !== undefined) {
        delta.bold = weight;
      }
      continue;
    }

    if (property === 'font-style') {
      const italic = getFontStyleOverride(value);
      if (italic !== undefined) {
        delta.italic = italic;
      }
      continue;
    }

    if (property === 'text-decoration' || property === 'text-decoration-line') {
      const underline = getTextDecorationOverride(value);
      if (underline !== undefined) {
        delta.underline = underline;
      }
    }
  }

  return delta;
};

const applyStyleDelta = (state: StyleState, delta: StyleDelta): StyleState => {
  return {
    bold: delta.bold ?? state.bold,
    italic: delta.italic ?? state.italic,
    underline: delta.underline ?? state.underline,
  };
};

const getFontWeightStyleOverride = (value: string): boolean | undefined => {
  if (isInheritedStyleKeyword(value)) {
    return undefined;
  }

  if (value === 'normal') {
    return false;
  }

  if (value === 'bold' || value === 'bolder') {
    return true;
  }

  const numericWeight = Number.parseInt(value, 10);
  if (Number.isFinite(numericWeight)) {
    return numericWeight >= 600;
  }

  return undefined;
};

const getFontStyleOverride = (value: string): boolean | undefined => {
  if (isInheritedStyleKeyword(value)) {
    return undefined;
  }

  if (value === 'normal') {
    return false;
  }

  if (value === 'italic' || value.startsWith('oblique')) {
    return true;
  }

  return undefined;
};

const getTextDecorationOverride = (value: string): boolean | undefined => {
  if (isInheritedStyleKeyword(value)) {
    return undefined;
  }

  if (value === 'none' || value === 'normal') {
    return false;
  }

  if (value.includes('underline')) {
    return true;
  }

  return undefined;
};

const isInheritedStyleKeyword = (value: string): boolean => {
  return (
    value === 'inherit' ||
    value === 'initial' ||
    value === 'unset' ||
    value === 'revert' ||
    value === 'revert-layer'
  );
};

const findTagEndIndex = (html: string, startIndex: number): number => {
  let index = startIndex + 1;
  let quote: '"' | "'" | null = null;

  while (index < html.length) {
    const character = html[index];

    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      index += 1;
      continue;
    }

    if (character === '>') {
      return index;
    }

    index += 1;
  }

  return -1;
};

const decodeHtmlEntities = (text: string): string => {
  if (text.indexOf('&') === -1) {
    return text;
  }

  let decoded = '';
  let index = 0;

  while (index < text.length) {
    const ampersandIndex = text.indexOf('&', index);
    if (ampersandIndex === -1) {
      decoded += text.slice(index);
      break;
    }

    decoded += text.slice(index, ampersandIndex);

    const semicolonIndex = text.indexOf(';', ampersandIndex + 1);
    if (semicolonIndex === -1) {
      decoded += text.slice(ampersandIndex);
      break;
    }

    const entityName = text.slice(ampersandIndex + 1, semicolonIndex);
    const entityValue = decodeHtmlEntity(entityName);
    if (entityValue === null) {
      decoded += text.slice(ampersandIndex, semicolonIndex + 1);
    } else {
      decoded += entityValue;
    }

    index = semicolonIndex + 1;
  }

  return decoded;
};

const decodeHtmlEntity = (entityName: string): string | null => {
  if (entityName.startsWith('#x') || entityName.startsWith('#X')) {
    const codePoint = Number.parseInt(entityName.slice(2), 16);
    return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : null;
  }

  if (entityName.startsWith('#')) {
    const codePoint = Number.parseInt(entityName.slice(1), 10);
    return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : null;
  }

  return ENTITY_REPLACEMENTS[entityName] ?? null;
};
