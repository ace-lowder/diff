export const getWordCount = (text: string): number => {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return 0;
  }

  return trimmedText.split(/\s+/).length;
};
