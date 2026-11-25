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

- `pathway/`: readable source and pack script for `public/pathway.html` (see its README)
- `src/App.tsx`: home page with all diagram cards
- `src/shell.tsx`: shared editor shell (undo, zoom, autosave, export)
- `src/editors/`: one file per diagram family (`nutrition.tsx`: macronutrient triangle 49 and nutritional geometry 50)
- `src/lib/xyaxis.js`: x–y plots (17, 18, 21)
- `src/lib/molecule.tsx`: molecules from SMILES (19, 20)
- `src/ds/`: Scientific Diagram design system
- `tests/xyaxis.test.cjs`: run with `node tests/xyaxis.test.cjs`
- `src/lib/contour.js`: contour lines and bands (25), run `node tests/contour.test.cjs`
- `src/lib/kite.js`: kite outlines and diversity indices (26), run `node tests/kite.test.cjs`
- `src/lib/treemap.js`: squarified treemap layout (27), run `node tests/treemap.test.cjs`
- `src/lib/radar.js`: radar chart geometry (28), run `node tests/radar.test.cjs`
- `src/lib/special.js`, `survival.js`, `forest.js`, `prisma.js`: statistics for diagrams 29 to 31, run `node tests/stats.test.cjs`
- `src/lib/diagnostic.js` and `consort.js`: ROC, Bland-Altman and CONSORT arithmetic for diagrams 32 to 34, run with `node tests/stats.test.cjs`
- `src/lib/boxstats.js` and `volcano.js`: summary statistics, group tests, Benjamini-Hochberg and classification for diagrams 35 and 36, run with `node tests/stats.test.cjs`
- `src/lib/heatmap.js` and `venn.js`: clustering and set-overlap maths for diagrams 38 and 39, run with `node tests/stats.test.cjs`
- `src/lib/regress.js`, `enzyme.js` and `sankey.js`: regression, Michaelis-Menten fitting and Sankey layout for diagrams 40 to 42, run with `node tests/stats.test.cjs`
- `src/lib/calib.js`, `funnel.js` and `pie.js`: calibration fits, Egger's test and pie geometry for diagrams 43 to 45, run with `node tests/stats.test.cjs`
- `src/lib/pca.js`, `rarefy.js` and `growth.js`: principal components, rarefaction and growth-curve fitting for diagrams 46 to 48, run with `node tests/stats.test.cjs`
