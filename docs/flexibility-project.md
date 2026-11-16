# Flexibility and merge project

Goal: make each editor fit more kinds of figures, and fold near-duplicate editors into one.
Status as of 2026-11-16: milestones 1 and 2 done, 3 to 6 open.

## Milestones

| No. | Milestone | Status | Done when |
|---|---|---|---|
| M1 | Timeline without dates | Done | Timeline (14) has a "Stages (no dates)" scale with free text, drag reorder and numbered stages |
| M2 | Merge the six similar groups | Done | 48 editors become 36 through `source/src/editors/merge.tsx`; old links and saved projects open the merged editor |
| M3 | Flexibility review, batch 1: Methods | Open | Every Methods editor has no fixed date, unit or category list that blocks free text |
| M4 | Flexibility review, batch 2: Ecology, Cells, Pharmacology | Open | Same check passes for those fields |
| M5 | Flexibility review, batch 3: Evidence and clinical | Open | Same check passes; PRISMA and CONSORT accept custom box counts |
| M6 | Single data model per merged editor | Open | Modes share one table (for example one X-Y table across the six curve types) instead of six separate sheets |
| M7 | Migrate old workspace sheets | Open | Sheets saved under a removed editor id appear in the merged editor's sheet list |

## Flexibility checklist (M3 to M5)

Each editor is checked against these five points:

1. Axis, date and unit fields accept free text or a custom unit.
2. Category lists (groups, series, steps) have no fixed maximum.
3. Labels, titles and legends are editable on the sheet.
4. A blank start exists beside the templates.
5. Colours and sizes can be overridden per item.

## Done so far

- M1, commit `142f9e6`: Stages scale in `source/src/editors/timeline.tsx`.
- M2, commit `0ae5a87`: merged editors and aliases in `source/src/editors/merged.tsx`.

| Merged editor | Replaces |
|---|---|
| 03 Flow diagram | 03, 13, 22 |
| 29 PRISMA and CONSORT flow diagram | 29, 32 |
| 17 Curve with fit | 17, 18, 21, 41, 43, 48 |
| 40 Scatter plot | 40, 46 |
| 33 ROC, Bland-Altman and funnel plot | 33, 34, 44 |
| 35 Bar chart, box plot and violin plot | 35, 37 (the violin plot was added as a mode of 35) |

## Decisions

- Editor numbers are never reused. Gaps are folded editors.
- 07 Ecological pyramid and 09 Iceberg stay separate because their shapes differ.
- Merged editors wrap the old editors. Each mode keeps its own data until M6.
