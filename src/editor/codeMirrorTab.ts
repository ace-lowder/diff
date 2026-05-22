import { EditorSelection } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';

export const TAB_CHARACTER = '\t';
export const CODE_MIRROR_TAB_SIZE = 4;

export const insertTabCharacter: KeyBinding = {
  key: 'Tab',
  run(view) {
    const transaction = view.state.changeByRange((range) => {
      return {
        changes: {
          from: range.from,
          to: range.to,
          insert: TAB_CHARACTER,
        },
        range: EditorSelection.cursor(range.from + TAB_CHARACTER.length),
      };
    });

    view.dispatch({
      ...transaction,
      userEvent: 'input',
    });

    return true;
  },
};
