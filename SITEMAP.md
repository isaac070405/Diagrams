# Site Map and Page Hierarchy

Live site: https://isaac070405.github.io/Diagrams/

The site is a static single-page app. It has two files that load as pages (`index.html`, `pathway.html`) and one folder of images. Every other "page" is a view inside `index.html`, chosen by the URL hash (`#id`). A hash that matches no id shows the home page.

## Hierarchy

```
Diagrams site
├── index.html                      Home: "Diagram Workspace"
│   ├── Header: field filter chips, light/dark switch
│   ├── Diagram grid: 27 cards, sorted by number
│   │
│   ├── #<id>                       27 views, one per card: 25 shell editors, the pathway frame and the Icon library
│   │   ├── Editor shell (shared by 25 diagrams)
│   │   │   ├── Top bar: ← All diagrams, undo, redo, zoom
│   │   │   ├── Sheet: title, drawing, caption
│   │   │   ├── Below-sheet panels (diagram specific)
│   │   │   └── Sidebar panels, in order:
│   │   │       Edit · Diagram controls · Notes · Moved labels
│   │   │       Starting points · Figure (number, caption)
│   │   │       Diagram font · Save (PNG, transparent PNG, SVG, JPEG)
│   │   │       Saved in this browser (autosave and versions)
│   │   │
│   │   ├── #biological-pathway     Frame that embeds pathway.html
│   │   └── #icon-library           Icon library page
│   └── (no hash)                   Home
│
├── pathway.html                    Biological pathway editor (loaded in an iframe)
│   ├── Header: pathway title, node count, arrow count, save note
│   ├── Sidebar, in order:
│   │   Template (7 starting points + Blank Template)
│   │   1 Describe the pathway
│   │   2 Add flow and labels
│   │   3 Generate the diagram (Icons or Text only)
│   │   4 Edit on the sheet (Icon library, undo, add node, connect)
│   │   5 Style the figure (legend, preset, typeface, text colour, text size)
│   │   6 Export (PNG, transparent PNG, SVG)
│   │   Project file (save, open)
│   │   Versions
│   ├── Canvas sheet (1600 × 900)
│   ├── Inspector under the sheet: node, arrow, compartment or step
│   └── Icon library overlay (search, groups, add icon, add group)
│
└── icons/                          162 PNG icons, plus CREDITS.md
```

## Diagram views by field

Field names are the filter chips on the home page. Ids are the URL hash.

| No. | Diagram | Id | Field |
|---|---|---|---|
| 01 | System Thinking Circle | `system-thinking` | Methods |
| 02 | Phylogenetic tree | `phylogenetic-tree` | Evolution and genetics |
| 03 | Flow diagram | `flow-diagram` | Methods |
| 04 | Pedigree | `pedigree` | Evolution and genetics |
| 05 | Food web | `food-web` | Ecology |
| 06 | Punnett square | `punnett-square` | Evolution and genetics |
| 07 | Ecological pyramid | `ecological-pyramid` | Ecology |
| 08 | Dichotomous key | `dichotomous-key` | Evolution and genetics |
| 09 | Iceberg model | `iceberg-model` | Methods |
| 10 | Histological image | `scale-bar` | Cells and measurement |
| 11 | Gradient bar | `gradient-bar` | Cells and measurement |
| 12 | Biological pathway | `biological-pathway` | Cells and measurement |
| 12a | Icon library | `icon-library` | Cells and measurement |
| 13 | Product flow diagram | `product-flow` | Methods |
| 14 | Timeline | `timeline` | Methods |
| 15 | Ternary plot | `ternary-plot` | Cells and measurement |
| 16 | PK/PD compartment model | `pk-compartment` | Pharmacology |
| 17 | Concentration–time curve | `pk-curve` | Pharmacology |
| 18 | Dose–response curve | `dose-response` | Pharmacology |
| 19 | SAR scheme | `sar-scheme` | Pharmacology |
| 20 | Curly-arrow mechanism | `mechanism` | Pharmacology |
| 21 | Population over time | `population-time` | Ecology |
| 22 | Experimental workflow | `experimental-workflow` | Methods |
| 23 | Well plate labelling | `well-plate` | Methods |
| 24 | Gels and blots | `gel-blot` | Methods |
| 25 | Contour plot | `contour-plot` | Methods |
| 26 | Belt transect and kite diagram | `belt-transect` | Ecology |

## Field filter counts

| Field | Diagrams |
|---|---|
| Methods | 9 (01, 03, 09, 13, 14, 22, 23, 24, 25) |
| Evolution and genetics | 4 (02, 04, 06, 08) |
| Ecology | 4 (05, 07, 21, 26) |
| Cells and measurement | 5 (10, 11, 12, 12a, 15) |
| Pharmacology | 5 (16, 17, 18, 19, 20) |
| All | 27 cards |

## Navigation links

| From | To | Control |
|---|---|---|
| Home | any view | card link `#<id>` |
| Any view | Home | "← All diagrams" button |
| Biological pathway (editor) | Icon library overlay | "Icon library" button under step 4 |

## Saved state

Nothing leaves the browser. Each editor autosaves under `sd-maker:doc:<id>`. The pathway editor saves under `bio-pathway-v1` (sheet) and `bio-pathway-versions` (snapshots). Custom icons and groups are stored under `sd-maker:custom-icons` and shared by the home page and the pathway editor.

## Source map

| Path | Role |
|---|---|
| `site/` | Built pages served on GitHub Pages |
| `source/src/App.tsx` | Home page, routing by hash, card list |
| `source/src/shell.tsx` | Shared editor shell |
| `source/src/editors/` | One file per diagram family |
| `source/src/iconLibrary.tsx` | Icon library page |
| `source/pathway/template.html` | Readable source of `pathway.html` |
