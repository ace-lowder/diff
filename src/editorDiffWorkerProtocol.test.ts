import { describe, expect, it } from 'vitest';

import { getEditorDiffState } from './editorDiffState';
import { getEditorDiffWorkerResponse } from './editorDiffWorkerProtocol';

describe('getEditorDiffWorkerResponse', () => {
  it('preserves request id and returns computed editor diff state', () => {
    const request = {
      requestId: 42,
      draftText: 'one two',
      editorText: 'one two three',
    };

    expect(getEditorDiffWorkerResponse(request)).toEqual({
      requestId: 42,
      editorDiffState: getEditorDiffState({
        draftText: request.draftText,
        editorText: request.editorText,
      }),
    });
  });
});
