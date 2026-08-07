import { useCallback, useEffect, useRef, useState } from 'react';

import { getEditorDiffState, type EditorDiffState } from '../editorDiffState';
import { createEditorDiffWorker } from '../editorDiffWorkerClient';
import type { EditorDiffWorkerResponse } from '../editorDiffWorkerProtocol';

export type EditorTextSnapshot = {
  draftText: string;
  editorText: string;
};

const EDITOR_DIFF_UPDATE_DELAY_MS = 20;

export const useEditorDiffState = ({
  draftText,
  editorText,
  getCurrentText,
  syncCommittedText,
  onStateCommit,
}: {
  draftText: string;
  editorText: string;
  getCurrentText: () => EditorTextSnapshot;
  syncCommittedText: (text: EditorTextSnapshot) => void;
  onStateCommit: () => void;
}) => {
  const [editorDiffState, setEditorDiffState] = useState<EditorDiffState>(() =>
    getEditorDiffState({ draftText, editorText }),
  );
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const isWorkerBusyRef = useRef(false);
  const queuedTextRef = useRef<EditorTextSnapshot | null>(null);
  const latestTextRef = useRef({ draftText, editorText });
  const pendingUpdateTimeoutRef = useRef<number | null>(null);

  const clearPendingUpdate = useCallback(() => {
    if (pendingUpdateTimeoutRef.current !== null) {
      window.clearTimeout(pendingUpdateTimeoutRef.current);
      pendingUpdateTimeoutRef.current = null;
    }
  }, []);

  const commitState = useCallback(
    (nextState: EditorDiffState) => {
      onStateCommit();
      setEditorDiffState(nextState);
    },
    [onStateCommit],
  );

  const startWorkerRequest = useCallback(
    (text: EditorTextSnapshot) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const worker = workerRef.current;

      if (!worker) {
        commitState(getEditorDiffState(text));
        isWorkerBusyRef.current = false;
        return;
      }

      isWorkerBusyRef.current = true;
      worker.postMessage({ requestId, ...text });
    },
    [commitState],
  );

  const requestState = useCallback(
    (text: EditorTextSnapshot) => {
      if (isWorkerBusyRef.current) {
        queuedTextRef.current = text;
        return;
      }

      startWorkerRequest(text);
    },
    [startWorkerRequest],
  );

  const scheduleUpdate = useCallback(() => {
    clearPendingUpdate();
    pendingUpdateTimeoutRef.current = window.setTimeout(() => {
      pendingUpdateTimeoutRef.current = null;
      requestState(latestTextRef.current);
    }, EDITOR_DIFF_UPDATE_DELAY_MS);
  }, [clearPendingUpdate, requestState]);

  const flushEditorDiffState = useCallback(() => {
    clearPendingUpdate();
    const nextText = getCurrentText();
    latestTextRef.current = nextText;
    syncCommittedText(nextText);
    queuedTextRef.current = null;
    latestRequestIdRef.current += 1;
    const nextState = getEditorDiffState(nextText);
    commitState(nextState);
    return nextState;
  }, [clearPendingUpdate, commitState, getCurrentText, syncCommittedText]);

  useEffect(() => {
    latestTextRef.current = { draftText, editorText };
    scheduleUpdate();
  }, [draftText, editorText, scheduleUpdate]);

  useEffect(() => {
    const worker = createEditorDiffWorker();
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<EditorDiffWorkerResponse>) => {
      const queuedText = queuedTextRef.current;
      queuedTextRef.current = null;
      isWorkerBusyRef.current = false;

      if (queuedText) {
        startWorkerRequest(queuedText);
        return;
      }

      if (event.data.requestId !== latestRequestIdRef.current) {
        return;
      }

      commitState(event.data.editorDiffState);
    };

    return () => {
      clearPendingUpdate();
      worker.terminate();
      workerRef.current = null;
      isWorkerBusyRef.current = false;
      queuedTextRef.current = null;
    };
  }, [clearPendingUpdate, commitState, startWorkerRequest]);

  return { editorDiffState, flushEditorDiffState };
};
