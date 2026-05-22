import type { StatsMode } from '../editorDiff';

export type ConsoleCommandViewMode = 'draft' | 'editor' | 'split';

export type ConsoleCommand =
  | {
      type: 'view';
      mode: ConsoleCommandViewMode | 'next';
    }
  | {
      type: 'copy';
      target: 'document' | 'line';
    }
  | {
      type: 'count';
      statsMode: StatsMode | 'toggle';
    };

export type ConsoleCommandParseResult =
  | {
      kind: 'valid';
      command: ConsoleCommand;
    }
  | {
      kind: 'unknown-root';
    }
  | {
      kind: 'unknown-command';
      message: string;
    }
  | {
      kind: 'incomplete';
    }
  | {
      kind: 'not-command';
    };

export type ConsoleCommandOption = {
  label: string;
};

export type ConsoleCommandMenu = {
  options: ConsoleCommandOption[];
  tokenFrom: number;
  tokenTo: number;
};

const UNKNOWN_COMMAND_SUFFIX = ' - unknown command';
const NO_LINE_ABOVE_SUFFIX = ' - no line above to copy';

const ROOT_OPTIONS = ['view', 'copy', 'count'] as const;
const VIEW_OPTIONS = ['draft', 'editor', 'split'] as const;
const COPY_OPTIONS = ['line'] as const;
const COUNT_OPTIONS = ['word', 'char'] as const;

export const parseConsoleCommandLine = (
  lineText: string,
): ConsoleCommandParseResult => {
  if (!lineText.startsWith('/')) {
    return { kind: 'not-command' };
  }

  const trimmedLineText = lineText.trim();
  if (trimmedLineText === '/') {
    return { kind: 'incomplete' };
  }

  const parts = trimmedLineText.slice(1).split(/\s+/).filter(Boolean);
  const [root, option] = parts;

  if (!root) {
    return { kind: 'incomplete' };
  }

  if (!ROOT_OPTIONS.includes(root as (typeof ROOT_OPTIONS)[number])) {
    return { kind: 'unknown-root' };
  }

  if (root === 'view') {
    if (parts.length === 1) {
      return {
        kind: 'valid',
        command: { type: 'view', mode: 'next' },
      };
    }

    if (
      parts.length === 2 &&
      option &&
      VIEW_OPTIONS.includes(option as (typeof VIEW_OPTIONS)[number])
    ) {
      return {
        kind: 'valid',
        command: {
          type: 'view',
          mode: option as ConsoleCommandViewMode,
        },
      };
    }

    return {
      kind: 'unknown-command',
      message: `${trimmedLineText}${UNKNOWN_COMMAND_SUFFIX}`,
    };
  }

  if (root === 'copy') {
    if (parts.length === 1) {
      return {
        kind: 'valid',
        command: { type: 'copy', target: 'document' },
      };
    }

    if (parts.length === 2 && option === 'line') {
      return {
        kind: 'valid',
        command: { type: 'copy', target: 'line' },
      };
    }

    return {
      kind: 'unknown-command',
      message: `${trimmedLineText}${UNKNOWN_COMMAND_SUFFIX}`,
    };
  }

  if (parts.length === 1) {
    return {
      kind: 'valid',
      command: { type: 'count', statsMode: 'toggle' },
    };
  }

  if (parts.length === 2 && option === 'word') {
    return {
      kind: 'valid',
      command: { type: 'count', statsMode: 'words' },
    };
  }

  if (parts.length === 2 && option === 'char') {
    return {
      kind: 'valid',
      command: { type: 'count', statsMode: 'characters' },
    };
  }

  return {
    kind: 'unknown-command',
    message: `${trimmedLineText}${UNKNOWN_COMMAND_SUFFIX}`,
  };
};

export const getUnknownCommandLineText = (lineText: string): string => {
  return `${lineText.trimEnd()}${UNKNOWN_COMMAND_SUFFIX}`;
};

export const getNoLineAboveCommandLineText = (lineText: string): string => {
  return `${lineText.trimEnd()}${NO_LINE_ABOVE_SUFFIX}`;
};

export const getConsoleCommandMenu = ({
  lineText,
  cursorOffset,
}: {
  lineText: string;
  cursorOffset: number;
}): ConsoleCommandMenu | null => {
  if (!lineText.startsWith('/')) {
    return null;
  }

  const clampedCursorOffset = Math.max(0, Math.min(cursorOffset, lineText.length));
  const beforeCursor = lineText.slice(0, clampedCursorOffset);
  const trailingText = lineText.slice(clampedCursorOffset);
  if (/\S/.test(trailingText)) {
    return null;
  }

  const tokens = beforeCursor.split(/\s+/).filter(Boolean);
  const endsWithWhitespace = /\s$/.test(beforeCursor);
  const matches = [...beforeCursor.matchAll(/\S+/g)];
  const currentToken = matches.at(-1);

  if (!currentToken && tokens.length === 0) {
    return null;
  }

  const currentTokenText = endsWithWhitespace ? '' : (currentToken?.[0] ?? '');
  const tokenStart =
    endsWithWhitespace
      ? clampedCursorOffset
      : (currentToken?.index ?? clampedCursorOffset);
  const tokenEnd = endsWithWhitespace ? clampedCursorOffset : tokenStart + currentTokenText.length;

  if (tokens.length === 1) {
    if (endsWithWhitespace) {
      const root = tokens[0]?.replace(/^\//, '');
      const rootOptions = root ? getOptionsForRoot(root) : null;
      if (!rootOptions) {
        return null;
      }
      return {
        options: rootOptions.map((label) => ({ label })),
        tokenFrom: tokenStart,
        tokenTo: tokenEnd,
      };
    }

    if (
      currentTokenText === '/view' ||
      currentTokenText === '/copy' ||
      currentTokenText === '/count'
    ) {
      return null;
    }

    const rootPrefix = currentTokenText.startsWith('/')
      ? currentTokenText.slice(1)
      : currentTokenText;

    const options = getMatchingOptions(ROOT_OPTIONS, rootPrefix);
    if (options.length === 0) {
      return null;
    }

    return {
      options: options.map((label) => ({ label })),
      tokenFrom: tokenStart + (currentTokenText.startsWith('/') ? 1 : 0),
      tokenTo: tokenEnd,
    };
  }

  if (tokens.length !== 2) {
    return null;
  }

  const root = tokens[0].replace(/^\//, '');
  const optionPrefix = currentTokenText;
  const options = getOptionsForRoot(root);
  if (!options) {
    return null;
  }

  if (options.includes(optionPrefix as never)) {
    return null;
  }

  const matchingOptions = getMatchingOptions(options, optionPrefix);
  if (matchingOptions.length === 0) {
    return null;
  }

  return {
    options: matchingOptions.map((label) => ({ label })),
    tokenFrom: tokenStart,
    tokenTo: tokenEnd,
  };
};

export const getCompletedConsoleCommandLine = ({
  lineText,
  cursorOffset,
  selectedLabel,
}: {
  lineText: string;
  cursorOffset: number;
  selectedLabel: string;
}): string | null => {
  const menu = getConsoleCommandMenu({ lineText, cursorOffset });

  if (!menu) {
    return null;
  }

  return `${lineText.slice(0, menu.tokenFrom)}${selectedLabel}${lineText.slice(menu.tokenTo)}`;
};

export const getConsoleCommandPrediction = ({
  lineText,
  cursorOffset,
  selectedLabel,
}: {
  lineText: string;
  cursorOffset: number;
  selectedLabel: string;
}): string => {
  const menu = getConsoleCommandMenu({ lineText, cursorOffset });
  if (!menu) {
    return '';
  }

  const typedText = lineText.slice(menu.tokenFrom, menu.tokenTo);
  if (!selectedLabel.startsWith(typedText)) {
    return '';
  }

  return selectedLabel.slice(typedText.length);
};

// === Helpers ===

const getMatchingOptions = <TOption extends string>(
  options: readonly TOption[],
  prefix: string,
): TOption[] => {
  return options.filter((option) => option.startsWith(prefix));
};

const getOptionsForRoot = (
  root: string,
): readonly string[] | null => {
  if (root === 'view') {
    return VIEW_OPTIONS;
  }

  if (root === 'copy') {
    return COPY_OPTIONS;
  }

  if (root === 'count') {
    return COUNT_OPTIONS;
  }

  return null;
};
