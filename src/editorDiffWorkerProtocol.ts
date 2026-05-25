import {
  getEditorDiffState,
  type EditorDiffState,
} from './editorDiffState';

export type EditorDiffWorkerRequest = {
  requestId: number;
  draftText: string;
  editorText: string;
};

export type EditorDiffWorkerResponse = {
  requestId: number;
  editorDiffState: EditorDiffState;
};

export const getEditorDiffWorkerResponse = (
  request: EditorDiffWorkerRequest,
): EditorDiffWorkerResponse => {
  return {
    requestId: request.requestId,
    editorDiffState: getEditorDiffState({
      draftText: request.draftText,
      editorText: request.editorText,
    }),
  };
};
