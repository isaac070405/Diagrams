# Icon library and icon editor project

Goal: let users manage the icon library (12a) and clean up icons in a separate editor page (12b).
Status as of 2026-11-25: I1 to I5 done, I6 and I7 open.

## Scope

- 12a Icon library: add, edit and delete groups and icons. Icons move between groups.
- 12b Icon editor: crop edges, erase unwanted parts and remove the background.
- Biological pathway (12) is the only diagram that places icons. Other diagrams adopt the shared picker later, one at a time.

## Milestones

| No. | Milestone | Status | Done when |
|---|---|---|---|
| I1 | Override layer in `source/src/lib/iconOps.js` and `customIcons.ts` | Done | Storage holds hidden, renamed, moved and replaced entries for built-in icons, plus a Restore default action |
| I2 | 12a group editing | Done | Add group, rename group and delete group work for built-in and custom groups; deleting asks what happens to the icons |
| I3 | 12a icon editing | Done | Edit icon changes name and group (move), replaces the image, and deletes built-in and custom icons |
| I4 | 12b editor page | Done | New page `icon-editor` opens from a tile's Edit image button with crop, eraser and background removal, plus undo |
| I5 | Shared icon picker | Done | One browser component (`source/src/iconBrowser.tsx`) serves 12a, 12b and later diagrams through `<IconPicker onPick>`; Biological pathway (12) adopts it in I6 |
| I6 | Biological pathway reads overrides | Open | `source/public/pathway.html` shows renamed, moved, replaced and hidden icons from the same browser storage, and picks icons through the shared picker |
| I7 | Other diagrams place icons | Open | Each diagram that adopts the picker stores the icon key, not the image |

## 12a behaviour

- Built-in icons are static PNGs in `site/icons` with a catalogue in `source/src/lib/iconCatalog.ts`. Files stay untouched; edits are stored as overrides.
- Custom icons and overrides live in the browser (`sd-maker:custom-icons`), shared by every page.
- Group names stay unique, matched case-insensitively (`groupTaken`).
- Moving an icon changes its group only. Its key stays the same, so saved pathways keep working.
- A deleted icon leaves a blank space on pathway nodes that use it, as today.

## 12b behaviour

- Works on the 256 px version of one icon, with transparency kept.
- Crop edges: drag a rectangle, or trim transparent margins in one click.
- Erase unwanted parts: brush and eraser with adjustable size, and a lasso to remove a region.
- Remove background: click a colour with an adjustable tolerance, flood fill from the clicked point to transparent, and a global option for every pixel of that colour.
- Undo and redo for each step, plus a checkerboard preview.
- Save replaces the icon. Save as new icon keeps the original and files the copy in a chosen group.

## Decisions

- Diagrams store the icon key, so an edited icon updates everywhere.
- Edits to built-in icons never write to `site/icons`. Restore default removes the override.
- Open question: whether recolour and rotate belong in 12b after the first release.

## Notes from I1 to I3

- Edit logic is pure and tested: `source/src/lib/iconOps.js`, `source/tests/iconops.test.cjs` (23 tests, run in CI).
- Biological pathway (`pathway.html`) still ignores the `over` field, so it shows built-in icons as shipped. I6 closes this gap.
- Deleting a built-in group hides it and keeps its name reserved, so Restore cannot clash with a new group.
- I4: pixel logic is in `source/src/lib/iconPixels.js` (15 tests in `source/tests/iconpixels.test.cjs`, run in CI); the page is `source/src/iconEditor.tsx`, reached at `#icon-editor/<key>`.
- Browsers block pixel reads for pages opened as local files, so built-in icons load only when served over http(s). The page explains this and offers Open an image file.
- Recolour and rotate stay out of 12b for now.
- I5: `IconBrowser` (search, group chips, grid) is the one grid for the library page, the picker and the dialog. The library passes slots for group and tile actions, the picker passes none. `IconPicker` and `IconPickerDialog` return `{ key, name, group, ratio, url }`; a diagram stores `key`.
- Biological pathway is an iframe with its own picker code, so it cannot render the React component. I6 either asks the parent page for a pick over `postMessage` or reads the same storage; the choice is open.
- 12b uses the picker when opened without an icon and from Choose another icon.
