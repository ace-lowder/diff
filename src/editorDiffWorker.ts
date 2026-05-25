import {
  getEditorDiffWorkerResponse,
  type EditorDiffWorkerRequest,
  type EditorDiffWorkerResponse,
} from './editorDiffWorkerProtocol';

const workerSelf = self as unknown as {
  onmessage:
    | ((event: MessageEvent<EditorDiffWorkerRequest>) => void)
    | null;
  postMessage: (message: EditorDiffWorkerResponse) => void;
};

workerSelf.onmessage = (event) => {
  workerSelf.postMessage(getEditorDiffWorkerResponse(event.data));
};
