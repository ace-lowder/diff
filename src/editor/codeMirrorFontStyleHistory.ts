import { invertedEffects } from "@codemirror/commands";
import {
  Annotation,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
} from "@codemirror/state";

import {
  applyFontStyleDocumentChanges,
  mapFontStyleRangesThroughChanges,
  normalizeFontStyleRangesForText,
  type FontStyleRange,
  type FontStyleType,
  type TextChange,
} from "../fontStyles";

export const setCodeMirrorFontStyleRangesEffect =
  StateEffect.define<FontStyleRange[]>({
    map(value, mapping) {
      const changes: TextChange[] = [];
      mapping.iterChangedRanges((fromA, toA, fromB, toB) => {
        changes.push({ fromA, toA, fromB, toB });
      }, true);

      return mapFontStyleRangesThroughChanges({
        ranges: value,
        changes,
      });
    },
  });

export const codeMirrorRichPasteFontStyleRangesAnnotation =
  Annotation.define<FontStyleRange[]>();

export const createCodeMirrorFontStyleHistoryExtension = ({
  getInitialFontStyleRanges,
  getActiveFontStyleTypes,
}: {
  getInitialFontStyleRanges: () => FontStyleRange[];
  getActiveFontStyleTypes: () => FontStyleType[];
}): {
  field: StateField<FontStyleRange[]>;
  extension: Extension[];
} => {
  const field = StateField.define<FontStyleRange[]>({
    create(state) {
      return normalizeFontStyleRangesForText({
        ranges: getInitialFontStyleRanges(),
        text: state.doc.toString(),
      });
    },
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setCodeMirrorFontStyleRangesEffect)) {
          return normalizeFontStyleRangesForText({
            ranges: effect.value,
            text: transaction.newDoc.toString(),
          });
        }
      }

      if (!transaction.docChanged) {
        return value;
      }

      const changes: TextChange[] = [];
      transaction.changes.iterChanges((fromA, toA, fromB, toB) => {
        changes.push({ fromA, toA, fromB, toB });
      });

      return applyFontStyleDocumentChanges({
        ranges: value,
        changes,
        activeTypes: getActiveFontStyleTypes(),
        insertedFontStyleRanges:
          transaction.annotation(
            codeMirrorRichPasteFontStyleRangesAnnotation,
          ) ?? [],
        text: transaction.newDoc.toString(),
      });
    },
    compare(left, right) {
      return (
        left.length === right.length &&
        left.every((leftRange, index) => {
          const rightRange = right[index];
          return (
            rightRange !== undefined &&
            leftRange.type === rightRange.type &&
            leftRange.from === rightRange.from &&
            leftRange.to === rightRange.to
          );
        })
      );
    },
  });

  return {
    field,
    extension: [
      field,
      invertedEffects.of((transaction: Transaction) => {
        if (!transaction.docChanged) {
          return [];
        }

        return [
          setCodeMirrorFontStyleRangesEffect.of(
            transaction.startState.field(field),
          ),
        ];
      }),
    ],
  };
};
