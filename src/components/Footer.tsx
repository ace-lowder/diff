import type { CSSProperties } from 'react';

import { getWordCount, type EditorStats, type StatsMode } from '../editorDiff';
import type { AppMode, CoffeeStatus, CopyStatus } from '../appTypes';
import type { FontStyleType } from '../fontStyles';

type FooterProps = {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorStats: EditorStats;
  copyStatus: CopyStatus;
  coffeeStatus: CoffeeStatus;
  activeFontStyleTypes: FontStyleType[];
  onModeToggle: () => void;
  onStatsModeToggle: () => void;
  onToggleFontStyle: (fontStyleType: FontStyleType) => void;
  onCopyText: () => void;
  onCoffeeClick: () => void;
};

export const Footer = ({
  mode,
  statsMode,
  draftText,
  editorStats,
  copyStatus,
  coffeeStatus,
  activeFontStyleTypes,
  onModeToggle,
  onStatsModeToggle,
  onToggleFontStyle,
  onCopyText,
  onCoffeeClick,
}: FooterProps) => {
  return (
    <footer className="relative flex h-8 shrink-0 items-center border-t border-[#2A2B2C] bg-[#191A1B] text-sm">
      <button
        type="button"
        onClick={onModeToggle}
        className="flex h-full w-14 items-center justify-center border-r border-[#2A2B2C] text-center text-xs font-medium text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
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
        className="flex h-full w-8 items-center justify-center border-r border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
      >
        {coffeeStatus === 'clicked' ? <CheckIcon /> : <CoffeeIcon />}
      </a>

      <FooterStats
        mode={mode}
        statsMode={statsMode}
        draftText={draftText}
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
        className="absolute right-0 flex h-full w-8 items-center justify-center border-l border-[#2A2B2C] text-[#8C8C8C] hover:bg-[#242526] focus:outline-none focus-visible:bg-[#242526]"
      >
        {copyStatus === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </button>
    </footer>
  );
};

type FooterStatsProps = {
  mode: AppMode;
  statsMode: StatsMode;
  draftText: string;
  editorStats: EditorStats;
  onToggle: () => void;
};

const FooterStats = ({
  mode,
  statsMode,
  draftText,
  editorStats,
  onToggle,
}: FooterStatsProps) => {
  const buttonClassName =
    'absolute left-1/2 inline-flex -translate-x-1/2 items-center text-center leading-none text-[#8C8C8C] focus:outline-none';

  if (mode === 'draft') {
    const draftBaseLabel =
      statsMode === 'words' ? `${getWordCount(draftText)}w` : `${draftText.length}c`;

    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle footer stats between words and characters"
        className={buttonClassName}
      >
        {draftBaseLabel}
      </button>
    );
  }

  const baseLabel =
    statsMode === 'words' ? `${editorStats.wordCount}w` : `${editorStats.characterCount}c`;
  const addedLabel =
    statsMode === 'words'
      ? `+${editorStats.addedWordCount}`
      : `+${editorStats.addedCharacterCount}`;
  const deletedLabel =
    statsMode === 'words'
      ? `-${editorStats.deletedWordCount}`
      : `-${editorStats.deletedCharacterCount}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle footer stats between words and characters"
      className={buttonClassName}
    >
      <span>{baseLabel}</span>
      <span className="ml-1 text-xs leading-none text-[#2A4C2C]">{addedLabel}</span>
      <span className="ml-1 text-xs leading-none text-[#693330]">{deletedLabel}</span>
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
    <div className="absolute right-8 flex h-full items-center gap-2 pr-2">
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
        labelClassName="border-b border-current"
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
  isActive: boolean;
  onClick: () => void;
};

const FontStyleControlButton = ({
  label,
  ariaLabel,
  labelClassName,
  labelStyle,
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
      className={`inline-flex items-center justify-center px-1 text-xs font-normal ${stateClassName} hover:bg-[#242526] hover:text-[#D4D4D4] focus:outline-none focus-visible:bg-[#242526] focus-visible:text-[#D4D4D4]`}
    >
      <span
        className={`inline-flex h-4 min-w-3 items-center justify-center leading-none ${labelClassName ?? ''}`}
        style={labelStyle}
      >
        {label}
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
      <path d="M3 8h13v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
      <path d="M16 10h2a2 2 0 1 1 0 4h-2" />
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
