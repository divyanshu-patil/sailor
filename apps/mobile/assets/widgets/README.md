# Widget artwork

Placeholder art for the two iOS home-screen widgets, baked from in-repo SVG by
`scripts/mascots/bake.mjs`. Everything here is tagged `[REPLACE-LATER]` at its
source — swap the PNGs and nothing in the widget code has to change, **as long
as the aspect ratios below hold**.

These are copied into the App Group at app launch (`app/lib/widget-assets.ts`),
because a widget extension is a separate process and cannot read the app's
bundle cache. The widgets receive the resulting `file://` paths as props.

## Dimensions

| File | Pixels | Aspect | Used by | Drawn at (pt) | Scale |
| --- | --- | --- | --- | --- | --- |
| `widget-bg-cool-small.png` | 948 × 948 | 1:1 | practice, systemSmall | 158 × 158 (fills tile) | @6x |
| `widget-bg-cool-medium.png` | 2028 × 948 | 2.14:1 | practice, systemMedium | 338 × 158 | @6x |
| `widget-bg-streak-cool.png` | 474 × 474 | 1:1 | streak | 158 × 158 | @3x |
| `widget-mascot-purple.png` | 512 × 360 | 1.42:1 | practice, systemSmall | 124 w | @4.1x |
| `widget-mascot-cream.png` | 512 × 360 | 1.42:1 | practice, systemMedium | 158 w | @3.2x |
| `widget-mascot-green.png` | 512 × 360 | 1.42:1 | streak | 152 × 107 | @3.4x |
| `widget-flame.png` | 150 × 150 | 1:1 | streak | 36 × 36 | @4.2x |

Total ≈ 142 KB. The two practice plates are hand-drawn replacements at @6x; the
rest are still the generated placeholders. All RGBA with a transparent background except the background
plates, which carry their own opaque base colour.

There is one colour story. An earlier build alternated a warm and a cool set by
day; the warm plates, the pink and blue characters and the switch that chose
between them are gone, so nothing here is conditional any more.

Tile sizes are the common iPhone ones (`systemSmall` 158 × 158 pt,
`systemMedium` 338 × 158 pt). They vary by a few points across devices, which is
why nothing is sized to them exactly — see *Constraints* below.

## Constraints on replacements

**Background plates must keep their tile's aspect ratio.** They are drawn with
`resizable()` and no `aspectRatio` modifier, so they stretch to fill rather than
crop. A square plate dropped into the medium slot will smear.

**Mascot height is derived from width at 1.42:1.** `TodaysPracticeWidget.tsx`
computes `mascotHeight = width * 360 / 512`. A replacement at a different ratio
will squash. `StreakWidget.tsx` hardcodes `152 × 107` instead, so that one needs
updating by hand if the ratio changes.

**The mascots are domes, not circles** — cropped flat along the bottom so they
sit flush against the tile's bottom edge. The eyes sit at about 64% of the
height, and the widgets offset each character so the bleed stops above them; a
replacement with its eyes higher or lower needs those offsets revisited.

**Nothing may be larger than the tile it is drawn in.** A SwiftUI flexible frame
reports `max(childSize, proposedSize)` — it does not clamp — so art wider than
the tile makes the whole stack wider than the tile, and WidgetKit then crops the
text column. `scripts/check-widgets.mjs` asserts this. The background plates are
exempt only because `resizable()` makes them accept whatever they are proposed.

## Rebaking

```
node scripts/mascots/bake.mjs           # fills in anything missing
node scripts/mascots/bake.mjs --force   # regenerates everything
```

**Files that already exist are left alone.** This art is placeholder, meant to
be replaced by hand, and the plain bake once overwrote hand-drawn plates with
the generated ones. Use `--force` only after editing `shapes.mjs`, and check
what it is about to replace first. For the generated art the scatter is seeded,
so a forced rebake is byte-identical and any diff is reviewable.

`check-widgets.mjs` asserts both directions: every name `widget-sync.ts` asks
for is baked, and every baked file is named by it. An orphan fails the check
rather than shipping as art nobody sees.
