# Diagrams

Biological and metabolic diagrams.

## Diagram Workspace

A browser editor for scientific figures: 45 diagram types for lab reports, essays and slides. Export as PNG, SVG or JPEG.

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
| 27 | Treemap | 28 | Radar chart |
| 29 | PRISMA 2020 flow diagram | 30 | Forest plot |
| 31 | Kaplan-Meier survival curve | 32 | CONSORT flow diagram |
| 33 | ROC curve | 34 | Bland-Altman plot |
| 35 | Box plot | 36 | Volcano plot |
| 37 | Bar chart with error bars | 38 | Clustered heatmap |
| 39 | Venn diagram | 40 | Scatter plot with regression |
| 41 | Enzyme kinetics | 42 | Sankey diagram |
| 43 | Standard curve | 44 | Funnel plot |
| 45 | Pie and donut chart | | |

## Contour plot

Lines and filled bands of equal value. Type or paste (x, y, value) points, or pick a built-in surface. The grid between points is filled by inverse distance weighting, with a smoothing slider. Level count or a fixed step, bold index lines, level labels along the lines, five colour ramps with a colour bar, and a switch to put y = 0 at the top for depth or time. Three starting points: sea-floor depth, temperature by depth and month (a thermocline), and a two-nutrient response.

## Belt transect and kite diagram

Quadrat counts along a belt transect, drawn as the belt with its quadrats and one kite per species. A kite is as wide as the count at each distance and pinches to its baseline where the count is 0. Species and quadrats are tables. The Results panel gives total and mean density per m² for each species, Shannon H′, Simpson 1 − D and Pielou J. Two starting points: three species along a transect and rocky shore zonation.

## Treemap

Nested rectangles whose area is proportional to each item's value, laid out by the squarified algorithm so tiles stay close to square. Groups are coloured blocks with a title and share of the total. Items are a table of name, group and value. Switches for sorting, titles, names, values or percent of total, a gap and a fill strength. The Results panel lists each group's total and share. Three starting points: dietary energy by food group, fisheries catch and reef benthic cover (sample values).

## Radar chart

Several variables on spokes from one centre, with one polygon per series. Axes and series are tables. All axes share a minimum and maximum, and any axis can set its own maximum so different units fit one web. Polygon or circular rings, fill strength, dots, values beside dots, ring values and a legend. The Results panel gives each polygon's area as a share of the full web. Three starting points: nutrient adequacy of two diets, reef health scores at three sites and species traits on separate scales (sample values).

## PRISMA 2020 flow diagram

Study selection for a systematic review, in the three PRISMA phases: identification, screening and included. Enter the counts from the search. Records screened, reports sought, reports assessed and reports included are worked out, so the figure always adds up, and the Check panel warns when a step goes below 0. Reasons for excluding reports are a table. An optional second column covers websites, organisations and citation searching. Two starting points with sample counts.

## Forest plot

Meta-analysis figure. Enter each study's effect and 95% interval. Ratios (odds, risk, hazard) use a log axis with the null at 1 and are pooled on the log scale. Differences use a linear axis with the null at 0. Fixed-effect (inverse variance) or random-effects (DerSimonian-Laird) pooling, a diamond for the pooled estimate, weights, Cochran Q, I², τ² and a test for the overall effect. Three starting points with sample values.

## Kaplan-Meier survival curve

Time-to-event curves, one per group, from a table with one row per subject (group, time, event or censored). Tick marks for censored subjects, 95% confidence bands (log-log), median survival lines, a number-at-risk table and the log-rank test for two or more groups. The 6-MP leukaemia trial (Freireich et al., 1963) is a starting point and reproduces the published medians (23 and 8 weeks) and log-rank chi-square of 16.8. Two simulated examples.

## CONSORT flow diagram

Participant flow through a randomised trial in the four CONSORT 2010 phases: enrollment, allocation, follow-up and analysis, for two to four arms. Enter the number assessed, the exclusions with reasons, and per arm the allocated, did-not-receive, lost, discontinued and excluded-from-analysis counts, each with optional reasons. Randomised, received and analysed are worked out, and the Check panel flags counts that do not add up. Two starting points with sample counts.

## ROC curve

Diagnostic accuracy for one or more markers. One row per subject: tick Case if they have the condition, then a value for each marker. Tick Low on a marker where lower values mean disease. The AUC uses the trapezoid rule, with a 95% CI from the Hanley and McNeil standard error and a test against 0.5. The best cutoff by Youden's index is marked and reported with its sensitivity and specificity. Three starting points (simulated): a biomarker, two screening tools and serum ferritin for iron deficiency.

## Bland-Altman plot

Agreement between two measurement methods. One row per participant with both values. The plot shows the difference (or percent difference) against the mean, with the mean difference and 95% limits of agreement, each with a confidence interval from Student's t. A trend line and its slope test show whether the bias changes with the size of the measurement. Three starting points (simulated): a food frequency questionnaire against a food record, two vitamin D assays and bioimpedance against DXA.

## Box plot

Distribution by group. Paste each group's values (one spreadsheet column works). The box is the first quartile, median and third quartile (R type 7). Whiskers reach the furthest value within 1.5 IQR, or the minimum and maximum. Outliers are open circles. Options for every data point, the mean, sample sizes, a grid and an axis from 0. Two groups get a Welch t-test or Mann-Whitney U test with a bracket. Three or more get one-way ANOVA or Kruskal-Wallis. These give one overall p value and do not adjust for multiple comparisons. Three starting points (simulated).

## Volcano plot

Effect size against significance for many features. Paste rows of name, log2 fold change and p value (commas, tabs or spaces; header rows are skipped). Set a fold-change cut and a p limit, and optionally use Benjamini-Hochberg adjusted p values. Up, down and not significant points are coloured and counted, threshold lines are optional, and the most significant points are labelled without overlap. The Results panel lists the top features with p and q values. Two starting points (simulated): gene expression and metabolomics.

## Bar chart with error bars

Grouped bars (or dots) by category and series. Type each cell's replicates and the mean and the error bar (SEM, SD or 95% CI from Student's t) are worked out, or switch to Mean, error and type the values from a paper. Replicates can be drawn as dots. In replicate mode each category gets an overall test across the series (Welch t-test or one-way ANOVA, or the rank versions) shown as stars with a bracket, with no adjustment for the number of categories. Three starting points (simulated, plus one with entered summary values).

## Clustered heatmap

A matrix as colours. Paste a table with column names on top and row names on the left. Scale as entered, by row z-score or log10(x + 1). Rows and columns are reordered by agglomerative clustering (average, complete or single linkage; 1 − correlation or Euclidean distance) and drawn with dendrograms. Five colour ramps with a fixed range if wanted, values in large cells, a colour bar and the clustered order in the Results panel. Limit of 6,000 cells. Three starting points (simulated): gene expression, a nutrient correlation matrix and reef cover.

## Venn diagram

Overlaps between two or three lists. Paste each set's items, one per line, and the count in every region is worked out, with the shared items listed in the Results panel. Case can be ignored. Two sets can be drawn to scale (circle and overlap areas follow the counts); three sets use equal circles. Counts or percent, item names in small regions and set sizes in the titles. Three starting points.

## Scatter plot with regression

Points with a least squares line. Paste x, y and an optional group on each row. The line, a 95% confidence band for the line and a 95% prediction band are optional, with the equation, r, R², p and n on the figure. With groups, fit one line to all points or one per group. The Results panel gives slope, intercept and r with 95% intervals (Student's t, Fisher z), the residual SD and Spearman rho. Three starting points (simulated).

## Enzyme kinetics

Initial rates against substrate concentration, one column per condition (for example without and with an inhibitor). The Michaelis-Menten curve is fitted by nonlinear least squares (Levenberg-Marquardt), giving Vmax and Km with standard errors and 95% intervals, R² and, with an enzyme concentration, kcat and kcat/Km. Switch the plot to Lineweaver-Burk, Eadie-Hofstee or Hanes-Woolf to see straight lines and tell competitive from non-competitive inhibition. The straight-line estimates are listed beside the fit for comparison. Three starting points (simulated).

## Sankey diagram

Flows between stages, drawn as bands whose width is the amount. Paste flows as source, target and value. Columns come from the longest path (no loops allowed), node order is arranged to reduce crossings, and the Check panel flags any middle node that does not pass on what it receives. Colour by source, by target or grey, justified or left alignment, optional unit and values in the labels. Three starting points: dietary energy partition, participant flow and carbon flow (illustrative values).

## Standard curve

A calibration curve from known standards, with unknown samples read back off it. Paste standards as concentration and signal (repeat a concentration for replicates) and unknowns as name and signal. Three models: straight line, semi-log (signal against log10 concentration, the usual qPCR fit, which also reports amplification efficiency) and a four-parameter logistic for the S-shaped ELISA curve (fitted by Levenberg-Marquardt, 5 or more standards). Unknowns are marked on the curve, with 95% intervals for the straight-line and semi-log models, and readings outside the standards or beyond the curve's asymptotes are flagged. Three starting points (simulated).

## Funnel plot

A check for small-study effects in a meta-analysis. Paste each study as name, estimate, lower and upper 95% limit. The plot shows effect against standard error with the pooled centre line and 95% (and optionally 99%) pseudo confidence limits, on a log scale for ratios. Egger's regression test reports the asymmetry intercept with its 95% interval and p value, and warns when there are fewer than 10 studies. Asymmetry can come from heterogeneity as well as bias, which the help text says. Three starting points (simulated).

## Pie and donut chart

Shares of a whole. One row per slice with a name, a value and a colour. A hole size turns the pie into a donut with the total in the centre. Labels can sit outside with leader lines pushed apart so they never overlap, show percent inside the slices, or go in a legend, with percent, values and a unit. Start angle and largest-first ordering. Three starting points: macronutrient energy, fatty acid composition and benthic cover (illustrative values).

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

80 BioRender icons in 7 groups (receptors, proteins, nucleic acids, small molecules, cytokines and immune cells, lab equipment, cells), reached in two places:

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
