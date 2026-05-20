export const getMissingLineWidgetAnchor = ({
  docText,
  lineNumber,
  placement,
}: {
  docText: string;
  lineNumber: number;
  placement: 'before' | 'after';
}): { position: number; side: -1 | 1 } | null => {
  const lines = docText.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) {
    return null;
  }

  const lineStarts: number[] = [];
  let position = 0;
  for (const line of lines) {
    lineStarts.push(position);
    position += line.length + 1;
  }

  const getLineStart = (targetLineNumber: number): number => {
    return lineStarts[targetLineNumber - 1];
  };

  const getLineEnd = (targetLineNumber: number): number => {
    return getLineStart(targetLineNumber) + lines[targetLineNumber - 1].length;
  };

  if (placement === 'after') {
    return { position: getLineEnd(lineNumber), side: 1 };
  }

  if (lineNumber === 1) {
    return { position: getLineStart(1), side: -1 };
  }

  return { position: getLineEnd(lineNumber - 1), side: 1 };
};
