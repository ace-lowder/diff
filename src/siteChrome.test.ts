import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are not included in app tsconfig.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node typings are not included in app tsconfig.
import { resolve } from 'node:path';

const sourceDirectory = resolve(new URL('.', import.meta.url).pathname);
const indexHtml = readFileSync(resolve(sourceDirectory, '../index.html'), 'utf8');
const indexCss = readFileSync(resolve(sourceDirectory, './index.css'), 'utf8');
const menuSource = readFileSync(
  resolve(sourceDirectory, './components/Menu.tsx'),
  'utf8',
);

describe('site chrome metadata', () => {
  it('names the app Diff', () => {
    expect(indexHtml).toContain('<title>Diff</title>');
  });

  it('describes the local draft comparison', () => {
    expect(indexHtml).toContain(
      'Compare drafts and see every change in a private, local-first text editor.',
    );
  });

  it('declares dark color scheme in index.html', () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark" />');
  });

  it('declares dark theme color in index.html', () => {
    expect(indexHtml).toContain('<meta name="theme-color" content="#121314" />');
  });

  it('sets viewport maximum scale in index.html', () => {
    expect(indexHtml).toContain('maximum-scale=1.0');
  });

  it('sets viewport fit cover in index.html', () => {
    expect(indexHtml).toContain('viewport-fit=cover');
  });

  it('links coffee support to Venmo', () => {
    expect(menuSource).toContain(
      'https://venmo.com/cvbnm?amount=5&note=Thanks%20for%20making%20diff%20free%20%F0%9F%92%B8%0AHave%20a%20coffee,%20on%20me%20%E2%98%95',
    );
  });
});

describe('site chrome base styles', () => {
  it('sets dark color scheme in css', () => {
    expect(indexCss).toContain('color-scheme: dark;');
  });

  it('sets dark background color in css', () => {
    expect(indexCss).toContain('background-color: #121314;');
  });

  it('sets default menu height css variable', () => {
    expect(indexCss).toContain('--diff-menu-height: 36px;');
  });

  it('sets default line number gutter width css variable', () => {
    expect(indexCss).toContain('--diff-line-number-gutter-width: calc(6ch + 2ch);');
  });

  it('defines html selector in css', () => {
    expect(indexCss).toContain('html,');
  });

  it('defines body selector in css', () => {
    expect(indexCss).toContain('body,');
  });

  it('defines root selector in css', () => {
    expect(indexCss).toContain('#root');
  });

  it('sets webkit text-size-adjust in css', () => {
    expect(indexCss).toContain('-webkit-text-size-adjust: 100%;');
  });

  it('sets text-size-adjust in css', () => {
    expect(indexCss).toContain('text-size-adjust: 100%;');
  });
});
