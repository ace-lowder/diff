export const createEditorDiffWorker = (): Worker => {
  return new Worker(new URL('./editorDiffWorker.ts', import.meta.url), {
    type: 'module',
  });
};
