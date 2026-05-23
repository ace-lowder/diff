export const FONT_STYLE_CONTROL_HOVER_CLASS_NAME =
  'byline-font-style-control-hover';

export const ITALIC_FONT_STYLE_LABEL_CLASS_NAME = 'italic top-px';

export const getFontStyleControlButtonClassName = (
  isActive: boolean,
): string => {
  const stateClassName = isActive
    ? 'rounded-sm bg-[#242526] text-[#D4D4D4]'
    : 'rounded-sm text-[#8C8C8C]';

  return `inline-flex h-7 w-6 items-center justify-center text-[length:var(--byline-font-size)] font-normal sm:w-7 ${stateClassName} ${FONT_STYLE_CONTROL_HOVER_CLASS_NAME} focus:outline-none focus-visible:bg-[#242526] focus-visible:text-[#D4D4D4]`;
};
