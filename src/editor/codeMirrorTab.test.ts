import { describe, expect, it } from 'vitest';

import { CODE_MIRROR_TAB_SIZE, TAB_CHARACTER } from './codeMirrorTab';

describe('codeMirrorTab', () => {
  it('exports the tab character constant', () => {
    expect(TAB_CHARACTER).toBe('\t');
  });

  it('exports tab size as 4', () => {
    expect(CODE_MIRROR_TAB_SIZE).toBe(4);
  });
});
