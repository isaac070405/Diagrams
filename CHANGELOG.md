# Changelog

All notable changes to Diagram Workspace are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Nutrition science, a new group on the home page, with two editors:
  - Macronutrient triangle (49): the macronutrient template moved here from the ternary plot, plus the AU/NZ acceptable macronutrient distribution range and a diet-change path.
  - Nutritional geometry (50): nutrient space for nutritional ecology with food rails, an intake target, feeding paths, deficit and excess arrows and zones, an equal-energy line, and a performance landscape (peak or gradient) as colour bands and contours. Seven templates.

### Changed

- Ternary plot (15): the macronutrient template moved to the Macronutrient triangle (49). Saved ternary sheets keep their data.

- Timeline (14): a "Stages (no dates)" scale with free-text labels and drag reorder.
- 12 editors folded into 6 merged ones (48 to 36 types). See `docs/flexibility-project.md`.

## [1.1.0] - 2026-11-15

The workspace grows from 21 to 48 diagram types, with an icon library, many editor improvements and accessibility fixes.

### Added

- 27 diagram types (22 to 48):
  - Methods and measurement: experimental workflow (22), well plate labelling (23), gels and blots (24), contour plot (25), belt transect and kite diagram (26), treemap (27), radar chart (28), box plot (35), bar chart with error bars (37), clustered heatmap (38), Venn diagram (39), scatter plot with regression (40), Sankey diagram (42), PCA plot (46).
  - Evidence and clinical (a new group on the home page): PRISMA 2020 flow diagram (29), forest plot (30), Kaplan-Meier survival curve (31), CONSORT flow diagram (32), ROC curve (33), Bland-Altman plot (34), funnel plot with Egger's test (44).
  - Cells and measurement and ecology: volcano plot (36), enzyme kinetics (41), standard curve (43), pie and donut chart (45), rarefaction and species accumulation (47), growth curve (48).
- An icon library of 80 BioRender icons in 7 groups, on the home page and inside Biological pathway, with Add icon and Add group (credits in `site/icons/CREDITS.md`).
- Histological image: stain and colour sliders, multi-panel layout, calibrated grid, crop and rotate presets, spline contour and intensity profile.
- Gradient bar: a line-only style, a colour-stop editor and four more templates.
- Food web: curved arrows, hover path highlight, a hydrothermal vent template, accordions, themes, a link linter, a snap grid and crossing reduction.
- Biological pathway: sidebar ordered by workflow, a Blank Template, more typefaces and text colours, and a typeface and colour for each node.
- Copy as PNG or SVG in every editor.
- Community files: ACCESSIBILITY, CHANGELOG, CITATION, CODE_OF_CONDUCT, CONTRIBUTING, LICENSE, SECURITY, SUPPORT and THIRD_PARTY_NOTICES.
- Tests for the statistics behind the new diagrams (`source/tests/`), including exact reference values.

### Changed

- The Scale bar diagram is now Histological image.
- Biological pathway no longer has the Claude first-draft bridge.
- The CI build job now builds the site.

### Fixed

- Accessibility: 44 px targets, main landmarks, chip roles, focus rules and keyboard access for series, steps and pathway links.
- A browser download is used when the Claude downloads capability is missing.

## [Earlier work]

Changes before this file existed are in the
[commit history](https://github.com/isaac070405/Diagrams/commits/main) and the pull requests.
The workspace had 26 diagram types, an 80-icon library, and PNG, SVG and JPEG export.
