# Diagram Workspace: source

React 19 + TypeScript, bundled with Parcel into one HTML file.

## Build

```
npm install -g pnpm@10      # once
pnpm install
pnpm approve-builds          # once: allow Parcel's native helpers
rm -rf dist bundle.html
pnpm exec parcel build index.html --dist-dir dist --no-source-maps
pnpm exec html-inline dist/index.html > bundle.html
```

Copy `bundle.html` to `../site/index.html`. `public/pathway.html` and `public/icons/` go next to it.

## Layout

- `src/App.tsx`: home page with all diagram cards
- `src/shell.tsx`: shared editor shell (undo, zoom, autosave, export)
- `src/editors/`: one file per diagram family
- `src/lib/xyaxis.js`: x–y plots (17, 18, 21)
- `src/lib/molecule.tsx`: molecules from SMILES (19, 20)
- `src/ds/`: Scientific Diagram design system
- `tests/xyaxis.test.cjs`: run with `node tests/xyaxis.test.cjs`
- `src/lib/contour.js`: contour lines and bands (25), run `node tests/contour.test.cjs`
- `src/lib/kite.js`: kite outlines and diversity indices (26), run `node tests/kite.test.cjs`
