import type { CSSProperties } from 'react';

import type { EditorStats, StatsMode } from '../editorDiff';
import type { AppMode, CoffeeStatus, CopyStatus } from '../appTypes';
import type { FontStyleType } from '../fontStyles';
import { getFooterStatsLabels } from './footerStatsLabels';
import {
  getMenuLayoutClassName,
  getMenuVisibilityClassName,
  type MenuVisibilityMode,
} from './menuVisibility';

type MenuProps = {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorText: string;
  editorStats: EditorStats;
  copyStatus: CopyStatus;
  coffeeStatus: CoffeeStatus;
  activeFontStyleTypes: FontStyleType[];
  onModeToggle: () => void;
  onStatsModeToggle: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onCopyText: () => void;
  onCoffeeClick: () => void;
  visibilityMode: MenuVisibilityMode;
  isVisible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

export const Menu = ({
  mode,
  statsMode,
  draftText,
  editorText,
  editorStats,
  copyStatus,
  coffeeStatus,
  activeFontStyleTypes,
  onModeToggle,
  onStatsModeToggle,
  onToggleFontStyle,
  onCopyText,
  onCoffeeClick,
  visibilityMode,
  isVisible,
  onPointerEnter,
  onPointerLeave,
}: MenuProps) => {
  const layoutClassName = getMenuLayoutClassName({ visibilityMode });
  const visibilityClassName = getMenuVisibilityClassName({
    visibilityMode,
    isVisible,
  });

  return (
    <nav
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={`${layoutClassName} z-50 flex h-10 shrink-0 items-center border-b border-[#2A2B2C] bg-[#191A1B] text-base transition-transform duration-200 ease-out sm:border-b-0 sm:border-t ${visibilityClassName}`}
    >
      <button
        type="button"
        onClick={onModeToggle}
        className="flex h-full w-16 items-center justify-center border-r border-[#2A2B2C] text-center text-sm font-medium text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
      >
        {getModeLabel(mode)}
      </button>

      <a
        href="https://ko-fi.com/acejack"
        target="_blank"
        rel="noreferrer"
        onClick={onCoffeeClick}
        aria-label="Support on Ko-fi"
        title="Support on Ko-fi"
        className="hidden h-full w-10 items-center justify-center border-r border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526] sm:flex"
      >
        {coffeeStatus === 'clicked' ? <CheckIcon /> : <CoffeeIcon />}
      </a>

      <MenuStats
        mode={mode}
        statsMode={statsMode}
        draftText={draftText}
        editorText={editorText}
        editorStats={editorStats}
        onToggle={onStatsModeToggle}
      />

      <FontStyleControls
        activeFontStyleTypes={activeFontStyleTypes}
        onToggleFontStyle={onToggleFontStyle}
      />

      <button
        type="button"
        onClick={onCopyText}
        aria-label={getCopyAriaLabel(copyStatus)}
        title={getCopyAriaLabel(copyStatus)}
        className="absolute right-0 flex h-full w-10 items-center justify-center border-l border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
      >
        {copyStatus === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </button>
    </nav>
  );
};

type MenuStatsProps = {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorText: string;
  editorStats: EditorStats;
  onToggle: () => void;
};

const MenuStats = ({
  mode,
  statsMode,
  draftText,
  editorText,
  editorStats,
  onToggle,
}: MenuStatsProps) => {
  const buttonClassName =
    'absolute left-1/2 inline-flex -translate-x-1/2 items-center text-center leading-none text-[#8C8C8C] focus:outline-none';
  const labels = getFooterStatsLabels({
    mode,
    statsMode,
    draftText,
    editorText,
    editorStats,
  });

  if (labels.kind === 'draft') {

    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle footer stats between words and characters"
        className={buttonClassName}
      >
        {labels.baseLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle footer stats between words and characters"
      className={buttonClassName}
    >
      <span>{labels.baseLabel}</span>
      <span className="ml-1 text-sm leading-none text-[#2A4C2C]">{labels.addedLabel}</span>
      <span className="ml-1 text-sm leading-none text-[#693330]">{labels.deletedLabel}</span>
    </button>
  );
};

type FontStyleControlsProps = {
  activeFontStyleTypes: FontStyleType[];
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
};

const FontStyleControls = ({
  activeFontStyleTypes,
  onToggleFontStyle,
}: FontStyleControlsProps) => {
  return (
    <div className="absolute right-10 flex h-full items-center gap-0.5 pr-1 sm:gap-2 sm:pr-2">
      <FontStyleControlButton
        label="B"
        ariaLabel="Toggle bold"
        isActive={activeFontStyleTypes.includes('bold')}
        onClick={() => onToggleFontStyle('bold')}
      />
      <FontStyleControlButton
        label="I"
        ariaLabel="Toggle italic"
        labelClassName="italic"
        labelStyle={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        isActive={activeFontStyleTypes.includes('italic')}
        onClick={() => onToggleFontStyle('italic')}
      />
      <FontStyleControlButton
        label="U"
        ariaLabel="Toggle underline"
        showUnderline
        isActive={activeFontStyleTypes.includes('underline')}
        onClick={() => onToggleFontStyle('underline')}
      />
    </div>
  );
};

type FontStyleControlButtonProps = {
  label: string;
  ariaLabel: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  showUnderline?: boolean;
  isActive: boolean;
  onClick: () => void;
};

const FontStyleControlButton = ({
  label,
  ariaLabel,
  labelClassName,
  labelStyle,
  showUnderline = false,
  isActive,
  onClick,
}: FontStyleControlButtonProps) => {
  const stateClassName = isActive
    ? 'rounded-sm bg-[#242526] text-[#D4D4D4]'
    : 'rounded-sm text-[#8C8C8C]';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-7 w-6 items-center justify-center text-sm font-normal sm:w-7 ${stateClassName} hover:bg-[#242526] hover:text-[#D4D4D4] focus:outline-none focus-visible:bg-[#242526] focus-visible:text-[#D4D4D4]`}
    >
      <span
        className={`relative inline-flex h-5 w-5 items-center justify-center leading-none ${labelClassName ?? ''}`}
        style={labelStyle}
      >
        {label}
        {showUnderline && (
          <span
            className="absolute bottom-0 h-px w-[8px] bg-current"
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
};

const CopyIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
};

const CoffeeIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="translate(0 -1)">
        <path d="M4.5 8.5h12v6.5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8.5Z" />
        <path d="M16.5 10h1.25a2.75 2.75 0 1 1 0 5.5H16.5" />
      </g>
    </svg>
  );
};

const CheckIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
};

const getModeLabel = (mode: AppMode): string => {
  if (mode === 'draft') {
    return 'Draft';
  }

  if (mode === 'editor') {
    return 'Editor';
  }

  return 'Split';
};

const getCopyAriaLabel = (copyStatus: CopyStatus): string => {
  if (copyStatus === 'copied') {
    return 'Copied text';
  }

  if (copyStatus === 'failed') {
    return 'Copy failed';
  }

  return 'Copy text with highlights';
};
