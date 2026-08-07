import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import type { LineGapMode } from '../appTypes';

export const CODE_MIRROR_LARGE_LINE_GAP_CLASS_NAME =
  'diff-line-gap-large';

export type CodeMirrorDisplaySettingsController = {
  extension: Extension[];
  reconfigureLineGapMode: (
    lineGapMode: LineGapMode,
  ) => ReturnType<Compartment['reconfigure']>;
  reconfigureWordWrapping: (
    isWordWrappingEnabled: boolean,
  ) => ReturnType<Compartment['reconfigure']>;
};

const getLineGapExtension = (lineGapMode: LineGapMode): Extension => {
  return lineGapMode === 'large'
    ? EditorView.editorAttributes.of({
        class: CODE_MIRROR_LARGE_LINE_GAP_CLASS_NAME,
      })
    : [];
};

const getWordWrappingExtension = (isWordWrappingEnabled: boolean): Extension => {
  return isWordWrappingEnabled ? EditorView.lineWrapping : [];
};

export const createCodeMirrorDisplaySettingsController = ({
  lineGapMode,
  isWordWrappingEnabled,
}: {
  lineGapMode: LineGapMode;
  isWordWrappingEnabled: boolean;
}): CodeMirrorDisplaySettingsController => {
  const lineGapCompartment = new Compartment();
  const wordWrappingCompartment = new Compartment();

  return {
    extension: [
      lineGapCompartment.of(getLineGapExtension(lineGapMode)),
      wordWrappingCompartment.of(getWordWrappingExtension(isWordWrappingEnabled)),
    ],
    reconfigureLineGapMode: (nextLineGapMode) =>
      lineGapCompartment.reconfigure(getLineGapExtension(nextLineGapMode)),
    reconfigureWordWrapping: (nextWordWrappingEnabled) =>
      wordWrappingCompartment.reconfigure(
        getWordWrappingExtension(nextWordWrappingEnabled),
      ),
  };
};
