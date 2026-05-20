export type DiffPaintGeometryRole =
  | 'inlineText'
  | 'tick'
  | 'missingLine'
  | 'fullLine'
  | 'activeLine';

export type PaintGeometryAdjustment = {
  topOffsetPx: number;
  bottomOffsetPx: number;
  leftOffsetPx: number;
  rightOffsetPx: number;
  widthPx?: number;
};

export type PaintRectBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const DIFF_PAINT_VERTICAL_OFFSET_PX = 8;
export const DIFF_TICK_WIDTH_PX = 3;
export const DIFF_FULL_LINE_LEFT_OFFSET_PX = 64;
export const DIFF_FULL_LINE_RIGHT_OFFSET_PX = 40;

export const DIFF_PAINT_GEOMETRY: Record<
  DiffPaintGeometryRole,
  PaintGeometryAdjustment
> = {
  inlineText: {
    topOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    bottomOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    leftOffsetPx: 0,
    rightOffsetPx: 0,
  },
  tick: {
    topOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    bottomOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    leftOffsetPx: 0,
    rightOffsetPx: 0,
    widthPx: DIFF_TICK_WIDTH_PX,
  },
  missingLine: {
    topOffsetPx: 0,
    bottomOffsetPx: 0,
    leftOffsetPx: 0,
    rightOffsetPx: 0,
  },
  fullLine: {
    topOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    bottomOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    leftOffsetPx: DIFF_FULL_LINE_LEFT_OFFSET_PX,
    rightOffsetPx: DIFF_FULL_LINE_RIGHT_OFFSET_PX,
  },
  activeLine: {
    topOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    bottomOffsetPx: DIFF_PAINT_VERTICAL_OFFSET_PX,
    leftOffsetPx: DIFF_FULL_LINE_LEFT_OFFSET_PX,
    rightOffsetPx: DIFF_FULL_LINE_RIGHT_OFFSET_PX,
  },
};

export const getAdjustedPaintRectBox = (
  rect: PaintRectBox,
  adjustment: PaintGeometryAdjustment,
): PaintRectBox | null => {
  const left = rect.left + adjustment.leftOffsetPx;
  const top = rect.top + adjustment.topOffsetPx;
  const width = rect.width + adjustment.rightOffsetPx - adjustment.leftOffsetPx;
  const height =
    rect.height + adjustment.bottomOffsetPx - adjustment.topOffsetPx;

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { left, top, width, height };
};
