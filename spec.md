# Captain Cloppy

## Current State
Profile page (`ProfilePage.tsx`) has multiple mobile layout issues:
- `StatCard` component spans have no overflow protection — `font-mono` BTC values overflow grid cells
- `grid-cols-2 md:grid-cols-4` in Financial Summary and Trading Stats Grid causes content overflow on narrow screens
- `break-all` on BTC monospace values splits numbers mid-digit
- Activity Heatmap has no scroll affordance
- Portfolio mobile cards have `shrink-0` on value column without overflow guard
- Identity Header principal ID uses `max-w-[160px]` fixed width

## Requested Changes (Diff)

### Add
- `min-w-0` to all grid children to prevent overflow blowout
- Scroll affordance hint on Activity Heatmap
- `overflow-hidden` / `truncate` guards where needed

### Modify
- `StatCard` inner value `<span>`: add `truncate` + `max-w-full` + `overflow-hidden` so long BTC strings don't bleed outside card
- Financial Summary grid: change to `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` so on very small phones each card gets full width
- Trading Stats Grid: same responsive grid adjustment
- PnL section values: replace `break-all` with `break-words` (cleaner mid-word breaks)
- Portfolio mobile card right-side value column: add `max-w-[120px]` guard so left side doesn't collapse
- Identity Header principal `max-w-[160px]`: remove fixed pixel cap, use `min-w-0 flex-1` instead
- Activity Heatmap wrapper: add `text-xs text-muted-foreground` scroll hint below on mobile

### Remove
- `break-all` class from PnL BTC value spans (replaced with `break-words`)

## Implementation Plan
1. Fix `StatCard` component to add `truncate overflow-hidden max-w-full` to value span and `min-w-0` to outer div
2. Update Financial Summary grid to `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`
3. Update Trading Stats Grid to `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`
4. Replace `break-all` with `break-words` in PnL section
5. Fix Identity Header principal ID display — remove `max-w-[160px]`, use `min-w-0 flex-1 break-all`
6. Fix Portfolio mobile card right-side column with max-width guard
7. Add scroll affordance text below Activity Heatmap on mobile
