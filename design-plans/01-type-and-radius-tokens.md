# Text sizes and corner rounding come from tokens

Written against: f1befeb

## Evidence chain

- Surface: painting screen, palette sheet, postmark screen, dialogs (all styled by `src/style.css`)
- Problem: 7 text sizes are written as literal pixel values in 11 rules, and 3 corner radii (4px, 12px, 999px) in 9 rules, outside the `:root` tokens.
- Design evidence: the brief asks for styles "in CSS variables that are easy to change"; `:root` in `src/style.css` already holds colors, sizes and `--radius` / `--label-size`.
- Owner: `src/style.css` `:root`
- Scope and affected surfaces: `src/style.css` only
- Uncertainty: none

## Design decision

Name every text size and corner radius once in `:root` and reference the tokens everywhere, so a restyle changes one place. Values stay the same; nothing should look different.

## Reuse

- Existing `--label-size` (11px) becomes `--text-xs`; existing `--radius` (16px) stays.
- New: `--text-sm` 13px, `--text-md` 14px, `--text-base` 15px, `--text-input` 16px (iPhone zooms into smaller fields), `--text-lg` 17px, `--text-xl` 22px; `--radius-xs` 4px, `--radius-sm` 12px, `--radius-pill` 999px.
- `50%` stays literal: it makes a shape round, it isn't a style choice.

## Changes

1. `src/style.css`
   - Change: add the tokens above to `:root`; replace each literal `font-size` and `border-radius` value with its token; replace `--label-size` uses with `--text-xs`.
   - Preserve: every computed size and radius.
   - Verify: `grep -nE "font-size: [0-9]|border-radius: [0-9]+px" src/style.css` returns nothing.

## Validation

- Interface: painting screen, palette list and editor, postmark screen, Clear and New stamp dialogs at 375px look identical to before.
- Repository: `npm run build` → builds without errors.

## Stop conditions

- Stop if any value would change visibly.

## Design documentation

- None (no DESIGN.md in the repository).
