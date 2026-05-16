import { describe, expect, it } from 'vitest';

import { getDisplayChanges, getEditorStats, getWordCount } from './editorDiff';

describe('getWordCount', () => {
  it('returns zero for empty text', () => {
    expect(getWordCount('')).toBe(0);
    expect(getWordCount('   ')).toBe(0);
  });

  it('counts one word', () => {
    expect(getWordCount('hello')).toBe(1);
  });

  it('counts multiple words', () => {
    expect(getWordCount('one two\nthree')).toBe(3);
  });
});

describe('getDisplayChanges', () => {
  it('keeps replacement behavior for 300 men example', () => {
    const changes = getDisplayChanges('300 men', 'Three hundred men');

    expect(changes[0]).toEqual({
      type: 'replaced',
      draftValue: '300',
      editorValue: 'Three',
    });
    expect(
      changes.some(
        (change) => change.type === 'inserted' && change.editorValue.includes('hundred'),
      ),
    ).toBe(true);
    expect(changes[changes.length - 1]).toEqual({
      type: 'equal',
      draftValue: 'men',
      editorValue: 'men',
    });
  });

  it('does not absorb equal paragraph text into replacement chunks', () => {
    const changes = getDisplayChanges(
      'It started with the 7 of us. I was down here with 5 of my men and a guide.',
      'It started with the seven of us. I was down here with five of my men and a guide.',
    );

    const replacementText = changes
      .filter((change) => change.type === 'replaced')
      .map((change) => `${change.draftValue}|${change.editorValue}`)
      .join('\n');

    expect(replacementText).not.toContain('I was down here with');
    expect(
      changes.some(
        (change) =>
          change.type === 'equal' &&
          change.editorValue.includes('I was down here with'),
      ),
    ).toBe(true);
  });

  it('keeps unchanged sentence text equal around nearby edits', () => {
    const changes = getDisplayChanges(
      'Foreman said they never surfaced. Guess they got lost.',
      'Foreman said they never surfaced. Said they must have gotten lost.',
    );

    expect(
      changes.some(
        (change) =>
          change.type === 'equal' &&
          change.editorValue.includes('Foreman said they never surfaced.'),
      ),
    ).toBe(true);
  });
});

describe('getEditorStats', () => {
  it('counts inserted-only text as added', () => {
    const changes = getDisplayChanges('one two', 'one two three');
    const stats = getEditorStats('one two three', changes);

    expect(stats.addedWordCount).toBe(1);
    expect(stats.deletedWordCount).toBe(0);
  });

  it('counts deleted-only text as deleted', () => {
    const changes = getDisplayChanges('one two three', 'one three');
    const stats = getEditorStats('one three', changes);

    expect(stats.deletedWordCount).toBeGreaterThan(0);
    expect(stats.addedWordCount).toBe(0);
  });

  it('counts replacement text as both added and deleted', () => {
    const changes = getDisplayChanges('300 men', 'Three hundred men');
    const stats = getEditorStats('Three hundred men', changes);

    expect(stats.addedWordCount).toBe(2);
    expect(stats.deletedWordCount).toBe(1);
  });
});
