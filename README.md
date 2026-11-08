# Diagrams

Biological and metabolic diagrams.

## Diagram Workspace

A browser editor for scientific figures: 26 diagram types for lab reports, essays and slides. Export as PNG, SVG or JPEG.

Open it online: https://isaac070405.github.io/Diagrams/

- `site/`: the built workspace. Open `site/index.html` in a browser. `pathway.html` and `icons/` must stay beside it.
- `source/`: the code. Build steps are in `source/README.md`.

Download the latest build from the Releases page.

Icon credits and licences are in `site/icons/CREDITS.md`.

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
| 23 | Well plate labelling | 24 | Gels and blots |
| 25 | Contour plot | 26 | Belt transect and kite diagram |

## Contour plot

Lines and filled bands of equal value. Type or paste (x, y, value) points, or pick a built-in surface. The grid between points is filled by inverse distance weighting, with a smoothing slider. Level count or a fixed step, bold index lines, level labels along the lines, five colour ramps with a colour bar, and a switch to put y = 0 at the top for depth or time. Three starting points: sea-floor depth, temperature by depth and month (a thermocline), and a two-nutrient response.

## Belt transect and kite diagram

Quadrat counts along a belt transect, drawn as the belt with its quadrats and one kite per species. A kite is as wide as the count at each distance and pinches to its baseline where the count is 0. Species and quadrats are tables. The Results panel gives total and mean density per m² for each species, Shannon H′, Simpson 1 − D and Pielou J. Two starting points: three species along a transect and rocky shore zonation.

## Gradient bar

The bar can be drawn as a thin line instead. In the Bar panel choose Line only: the line keeps the palette, ticks, items and end labels. The starting point "pH scale, line only" shows a red (acidic) to green (neutral, pH 7) to purple (basic) line from 0 to 14.

## Well plate labelling

6, 12, 24 and 96-well plates. Pick a group, then click wells on the sheet to paint them. Click a row letter or a column number to paint the whole row or column. Text inside wells comes from lines such as `A1:A8 | S1`. Four starting points: a 96-well ELISA layout and 6, 12 and 24-well plates.

## Gels and blots

SDS-PAGE gels and Western (protein), Eastern (modified protein), Southern (DNA) and Northern (RNA) blots. Lane 1 is the ladder, lane 2 the control, the rest are treatments, with at least two lanes. Cathode (−) is at the top and anode (+) at the bottom. Units are kDa, Da, kb or bp. Band height follows size on a log scale. Arrows point at named bands.

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

162 BioRender icons in 10 groups (receptors, proteins, nucleic acids, small molecules, cytokines and immune cells, lab equipment, cells, organs and systems, tissues, sugars and lipids), reached in two places:

- **Home page:** the Icon library card sits beside Biological pathway. It has search, group filters and a PNG download for each icon.
- **Inside Biological pathway:** the Icon library button under step 4, Edit on the sheet, opens the same catalogue over the sheet. Click an icon to add it, or to replace the icon on the selected node.

**Add icon** and **Add group** appear on both pages. Add icon takes a PNG, JPEG, SVG, WebP or GIF, scales it to 256 px and files it under a group. Add group creates a new group. Your icons and groups are stored in this browser, shared by both pages, and can be deleted with the × on a tile or the Delete group button.

## Biological pathway

The sidebar follows the order of work: Template (seven starting points and a Blank Template), 1 Describe the pathway, 2 Add flow and labels, 3 Generate the diagram, 4 Edit on the sheet (with the Icon library), 5 Style the figure, 6 Export. Styling offers 15 typefaces and 12 text colours plus a custom colour. Select a node to give its text its own typeface and colour. Loading a template keeps your typeface and text colour.

## Histological image

Annotate your own micrographs, or start from the artery example. Calibrate once with the image width, then every length, area and scale bar uses real units.

- **Graphics:** text, line, arrow, rectangle, circle, caliper, leader label and scale bar, with a list to show, lock, name and reorder them.
- **Contour:** a smooth curve around a structure, with area and perimeter in calibrated units.
- **Profile line:** draw a line across the image and a plot shows brightness, red, green or blue along it, with smoothing and the mean. The plot can be dragged and resized.
- **Grid:** lines, crosses or dots at a spacing you set in real units, with an optional printed spacing.
- **Crop and rotate:** 90° turns, flips, straighten and crop, with presets for 1:1, 4:3, 3:2 and 16:9 crops and 2×, 4× and 8× zoom. Turning keeps the framed region. The calibration follows.
- **Stain and colour:** brightness, contrast, gamma, saturation, hue and red, green, blue balance, with an H&E preset.
- **Panels:** up to 6 micrographs on one sheet, each with its own calibration, lettered A, B, C.
