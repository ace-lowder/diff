# Diff

Diff is a local-first writing editor for comparing a rough draft with an edited version.

[Open Diff](https://diffedit.com)

## Run locally

You need Git, Node.js 22.12 or newer, and npm.

```bash
git clone https://github.com/ace-lowder/diff.git
cd diff
npm ci
npm run dev
```

Open `http://localhost:5173`. Diff has no backend or environment variables; drafts stay in your browser.

## Commands

- `npm run dev` starts the local app
- `npm run test` runs the test suite once
- `npm run lint` checks the code
- `npm run build` creates the production build in `dist`
- `npm run preview` serves the production build locally

Built with React, TypeScript, Vite, Tailwind CSS, and CodeMirror.
