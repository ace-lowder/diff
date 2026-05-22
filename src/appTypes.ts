export type AppMode = 'draft' | 'editor' | 'split';

export type CodeMirrorTheme = 'draft' | 'editor';

export type ScrollOffset = {
  left: number;
  top: number;
};

export type PaneId = 'draft' | 'editor';

export type CopyStatus = 'idle' | 'copied' | 'failed';

export type CoffeeStatus = 'idle' | 'clicked';

export type TextLineContext = {
  text: string;
  from: number;
  to: number;
  number: number;
};

export type CopyLineContext = {
  pane: PaneId;
  line: TextLineContext;
};

export type CopyLineHandler = (context: CopyLineContext) => Promise<boolean>;
