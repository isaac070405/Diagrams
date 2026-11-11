# Accessibility

The project aims to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA for the workspace interface.

## Current state

- Controls are standard form elements and buttons, built on Radix UI primitives that handle focus and keyboard use.
- Exports are SVG, PNG or JPEG. Figures are images, so authors should add alt text where they place them.
- Several diagrams use colour to separate groups. Check contrast and add labels or patterns so meaning does not rely on colour alone.

## Known gaps

- The drawing sheet (canvas) is mostly pointer-driven. Keyboard-only editing of every diagram element is incomplete.
- Exported figures carry no alt text or long description.
- Screen reader testing has not been done on all 26 diagram types.

## Tips for accessible figures

- Choose high-contrast text and palette colours.
- Keep labels at a readable size. Avoid text smaller than 9 pt in the final document.
- Describe each figure in the caption or alt text of the report or slide.

## Feedback

Open an [issue](https://github.com/isaac070405/Diagrams/issues) titled "Accessibility:" with the diagram type, browser and assistive technology used.
