import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are not included in app tsconfig.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node typings are not included in app tsconfig.
import { resolve } from 'node:path';

const sourceDirectory = resolve(new URL('.', import.meta.url).pathname);
const indexHtml = readFileSync(resolve(sourceDirectory, '../index.html'), 'utf8');
const indexCss = readFileSync(resolve(sourceDirectory, './index.css'), 'utf8');

describe('site chrome metadata', () => {
  it('declares dark color scheme in index.html', () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark" />');
  });

  it('declares dark theme color in index.html', () => {
    expect(indexHtml).toContain('<meta name="theme-color" content="#121314" />');
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
    expect(indexCss).toContain('--byline-menu-height: 36px;');
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
});
