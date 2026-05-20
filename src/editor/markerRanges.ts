export type MarkerSide = 'left' | 'right';

export type MarkerRange = {
  from: number;
  to: number;
  side: MarkerSide;
};

export const getMarkerRange = ({
  text,
  position,
}: {
  text: string;
  position: number;
}): MarkerRange | null => {
  if (!text) {
    return null;
  }

  const clampedPosition = Math.max(0, Math.min(text.length, position));
  const lineStart = text.lastIndexOf('\n', clampedPosition - 1) + 1;
  const newlineIndex = text.indexOf('\n', clampedPosition);
  const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;

  if (lineStart === lineEnd) {
    return null;
  }

  for (let index = clampedPosition; index < lineEnd; index += 1) {
    return { from: index, to: index + 1, side: 'left' };
  }

  for (let index = clampedPosition - 1; index >= lineStart; index -= 1) {
    return { from: index, to: index + 1, side: 'right' };
  }

  return null;
};
