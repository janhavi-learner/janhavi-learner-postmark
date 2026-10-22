# The palette sheet is called "Palettes"

Written against: f1befeb

## Evidence chain

- Surface: palette sheet (list view), opened at start and by the palette button
- Problem: the sheet's title and accessible name say "Colors", while its trigger ("Change palette"), sections ("Your palettes"), action ("+ New palette") and editor ("Palette name") all say palette.
- Design evidence: direct contradiction in user-facing copy within one task.
- Owner: `src/palette-sheet.js` (`listView` heading), `index.html` (`#palette-sheet` aria-label)
- Scope and affected surfaces: those two lines
- Uncertainty: none

## Design decision

Title the sheet "Palettes" so it matches the button that opens it and everything inside it.

## Changes

1. `src/palette-sheet.js`: heading `Colors` → `Palettes`.
2. `index.html`: `#palette-sheet` `aria-label="Colors"` → `aria-label="Palettes"`.
   - Preserve: the swatch row's "Color" group label in the toolbar (it really is a set of colors).
   - Verify: the sheet shows "Palettes"; screen readers announce "Palettes".

## Validation

- Product: open the app; the sheet reads "Palettes".
- Repository: `npm run build` → builds without errors.

## Design documentation

- None.
