# Diagrams

Biological and metabolic diagrams.

## Diagram Workspace

A browser editor for scientific figures: 22 diagram types for lab reports, essays and slides. Export as PNG, SVG or JPEG.

Open it online: https://isaac070405.github.io/Diagrams/

- `site/`: the built workspace. Open `site/index.html` in a browser. `pathway.html` and `icons/` must stay beside it.
- `source/`: the code. Build steps are in `source/README.md`.

Download the latest build from the Releases page.

| No. | Diagram | No. | Diagram |
|---|---|---|---|
| 01 | System Thinking Circle | 12 | Biological pathway |
| 02 | Phylogenetic tree | 13 | Product flow diagram |
| 03 | Flow diagram | 14 | Timeline |
| 04 | Pedigree | 15 | Ternary plot |
| 05 | Food web | 16 | PK/PD compartment model |
| 06 | Punnett square | 17 | Concentration–time curve |
| 07 | Ecological pyramid | 18 | Dose–response curve |
| 08 | Dichotomous key | 19 | SAR scheme |
| 09 | Iceberg model | 20 | Curly-arrow mechanism |
| 10 | Histological image | 21 | Population over time |
| 11 | Gradient bar | 22 | Experimental workflow |

## Gradient bar

The bar can be drawn as a thin line instead. In the Bar panel choose Line only: the line keeps the palette, ticks, items and end labels. The starting point "pH scale, line only" shows a red (acidic) to green (neutral, pH 7) to purple (basic) line from 0 to 14.

## Experimental workflow

Step-by-step method figures: numbered step cards with a pictogram, a short description and a time or condition, followed by the figures that explain the method. Ten starting points:

- **ELISA:** direct, indirect, sandwich and competitive, each with a well cross-section that shows the antibody layers and a 96-well plate map (standards, blank, samples).
- **Flow cytometry:** fluidics and optics, and a three-plot gating strategy with counted percentages.
- **LDH assay:** the coupled reaction scheme (LDH, NAD⁺/NADH, diaphorase, INT to formazan) and a plate map with the assay controls.
- **DNA isolation:** silica spin-column steps.
- **PCR:** one-cycle schematic, thermal profile and doubling plot from the temperatures, times and cycle number you enter.
- **Gel electrophoresis:** a gel image from band sizes in bp, with a ladder on a log scale.
- **Titration:** the curve for a strong or weak acid against a strong base, with the equivalence point and an indicator range.

Steps can be added, reordered and given any of 34 pictograms. Figures are switched on in the sidebar and printed under the steps.

## Icon library

80 BioRender icons in 7 groups (receptors, proteins, nucleic acids, small molecules, cytokines and immune cells, lab equipment, cells), reached in two places:

- **Home page:** the Icon library card sits beside Biological pathway. It has search, group filters and a PNG download for each icon.
- **Inside Biological pathway:** the Icon library button at the top of the sidebar opens the same catalogue over the sheet. Click an icon to add it, or to replace the icon on the selected node.

## Histological image

Annotate your own micrographs, or start from the artery example. Calibrate once with the image width, then every length, area and scale bar uses real units.

- **Graphics:** text, line, arrow, rectangle, circle, caliper, leader label and scale bar, with a list to show, lock, name and reorder them.
- **Contour:** a smooth curve around a structure, with area and perimeter in calibrated units.
- **Profile line:** draw a line across the image and a plot shows brightness, red, green or blue along it, with smoothing and the mean. The plot can be dragged and resized.
- **Grid:** lines, crosses or dots at a spacing you set in real units, with an optional printed spacing.
- **Crop and rotate:** 90° turns, flips, straighten and crop, with presets for 1:1, 4:3, 3:2 and 16:9 crops and 2×, 4× and 8× zoom. Turning keeps the framed region. The calibration follows.
- **Stain and colour:** brightness, contrast, gamma, saturation, hue and red, green, blue balance, with an H&E preset.
- **Panels:** up to 6 micrographs on one sheet, each with its own calibration, lettered A, B, C.
