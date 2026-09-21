# Haptics

How this app vibrates, and the rules for adding more. Read this before touching
anything that plays feedback.

**Everything goes through `app/lib/haptics.ts`.** Do not import `Presets` from
`react-native-pulsar` in a screen. One file owns every preset choice so the
whole app can be retuned in one place and reviewed as a set, which is not
possible once forty call sites each name their own.

Stack: [Pulsar](https://docs.swmansion.com/pulsar) — `react-native-pulsar`
declared `^1.6.1`, **resolved 1.7.0**, backed by the `PulsarHaptics` **1.4.0**
pod on iOS. Tuned for iOS; Android inherits the same vocabulary through
Pulsar's own cross-platform mapping.

---

## 1. The rules

1. **Reach for the lightest rung that still reads.** Most presses are
   `weight.tap`. If everything is heavy, nothing is.
2. **Never `Presets.System.*`.** Those are the three iOS impact weights plus
   notification and selection — five short single hits with no way to say
   "barely there" or "this is the big one". Pulsar's own presets have the
   dynamic range the card grading depends on. The migration off them is done;
   do not reintroduce them.
3. **Fire on press-in, not on the result.** Feedback belongs under the finger.
   Waiting for a network call is what makes a button feel dead.
4. **One event, one haptic.** If a flow already plays something, do not add a
   second on the way past — check the handler it calls first.
5. **Never the only signal.** Haptics are off for some people and absent on
   some hardware. Every state they mark must also be visible or audible.
6. **Nothing repeating and uncontrolled.** A cue per frame is a buzz, not a
   cue: latch it (see `tickOnThresholdCross` in `useSwipeGesture`).
7. **Sound is always on** — `Settings.enableSound(true)` in `startHapticsSync`.
   Pulsar gates audio behind the same `play()` as the vibration, so the user's
   haptics switch silences both. That is intended: one switch, and no case
   where a muted app still chirps.

## 2. The weight ladder

Six rungs, very mild to very strong. Measured from the pod's generated pattern
data (`Sources/Pulsar/Presets/Generated/*.swift`) — peak amplitude, duration,
discrete event count — so "stronger" means stronger in the signal, not just in
the name.

| Rung | Preset | Peak | Duration | Events | Use for |
|---|---|---|---|---|---|
| `weight.tick` | `wisp` | 0.25 | 60ms | 1 | Ruler units, scroll ticks, crossing a drag threshold |
| `weight.tap` | `feather` | 0.45 | 180ms | 1 | The default press. Rows, cards, links |
| `weight.press` | `nudge` | 0.60 | 180ms | 2 | A press that chose something. CTAs, dial picks |
| `weight.firm` | `thump` | 1.00 | single hit | 1 | Committing, landing, snapping into place |
| `weight.heavy` | `pound` | 0.95 | 265ms | 3 | Something substantial happened *(pattern)* |
| `weight.max` | `batter` | 1.00 | 380ms | 5 | The loudest thing the app says *(pattern)* |

## 3. The semantic vocabulary

Prefer these over a raw rung — they say what happened, so the mapping can be
retuned without hunting for "the medium one".

| Group | Names |
|---|---|
| Flow | `start` · `advance` · `back` · `stepForward` · `stepBack` · `finishLine` · `boundary` · `threshold` |
| Selection | `select` · `selectGroup` · `toggleOn` · `toggleOff` |
| Outcomes | `success` · `successBig` · `celebrate` · `warn` · `error` · `destroy` |
| Recording | `recordStart` · `recordPause` · `recordStop` |
| Cards | `reveal` · `conceal` · `editStart` · `editCommit` |

`error` is `glitch` — eight closely spaced events, so it reads as *wrong*
rather than merely strong. That is what separates it from `heavy`, and why a
failure should never just be a big thump.

**Opposite actions get opposite cues.** `stepForward` (`nudge`, firm and quick)
against `stepBack` (`wane`, soft and decaying) in the new-script wizard;
`toggleOn` against `toggleOff`; teleprompter start against stop. Two buttons
side by side pressed without much looking should tell you which way you went.
The wizard's last step is the exception that proves it: "Generate" is
`weight.firm`, not `stepForward`, because it spends a generation and leaves the
form rather than advancing within it.

## 4. Cards: impact drives colour *and* feel

**One number decides both.** `getImpactTier(impact)` in
`script-practice/utils/colorAssignment.ts` returns 0–4; that index picks the
card's palette *and* its preset. They cannot drift apart, because there is
nothing to keep in sync.

| Tier | Impact | Colour | Haptic | |
|---|---|---|---|---|
| 0 | `< 0.20` | ice | `wisp` | an aside |
| 1 | `< 0.40` | cool blue | `feather` | ordinary |
| 2 | `< 0.60` | sand | `nudge` | worth noticing |
| 3 | `< 0.80` | amber | `pound` | a real beat *(pattern)* |
| 4 | `≥ 0.80` | coral | `batter` | the moment *(pattern)* |

Three decisions worth not re-litigating:

- **Colour encodes impact, not mood.** `impact` is a scalar 0–1, so it maps
  onto an intensity ramp. `delivery` is 32 unordered categories — no natural
  order to ramp along, and 32 hues is confetti. Mood already has its own
  channel in the `DeliveryPill` (emoji + label). Putting mood on colour would
  duplicate that *and* spend the one channel that can show intensity, leaving
  colour and haptics telling the user different things about the same card.
- **Thresholds are absolute, not rank quantiles.** The card generator's prompt
  says to "reserve values above 0.8 for genuinely standout moments … not every
  card". Quantiles put a fifth of *every* deck in the top bucket regardless, so
  a deck of uniformly calm lines still got a scarlet climax. Tolerable when it
  only tinted a card; dishonest once it decides how hard the phone hits you.
  Tier 4 begins at exactly the 0.8 the generator is aiming at.
- **The top two tiers are patterns, not louder hits.** A standout line should
  feel structurally different, not just stronger. Pulsar's presets are already
  multi-event, so this needs no `PatternComposer`.

Other card events: `threshold` on crossing the commit distance (latched, once
per crossing), `boundary` when there is no card to go to, `reveal`/`conceal` on
the hold-to-flip, `editStart`/`editCommit` on the text editor, and
`successBig` when the last card leaves the deck.

The **arriving** card's haptic plays, not the departing one's — it is the line
about to be spoken, and the point of grading it is to warn the hand before the
eye has finished reading.

## 5. Teleprompter speed

`playSpeedHaptic(speed)` gives each of the seven multipliers its own feel: the
slow end soft and drawn out, the fast end sharp and rapid-fire. The menu is
used mid-delivery with eyes on the script, so a distinct cue per step says which
one landed without looking.

| Speed | Preset | Peak | Duration | Events |
|---|---|---|---|---|
| 0.25x | `wane` | 0.42 | 450ms | slow fade |
| 0.5x | `feather` | 0.45 | 180ms | 1 |
| 1x | `nudge` | 0.60 | 180ms | 2 |
| 1.25x | `snap` | 0.70 | 90ms | 2 |
| 1.5x | `strike` | 0.75 | 80ms | 1 |
| 2x | `spark` | 1.00 | 185ms | 3 |
| 3x | `barrage` | 1.00 | 309ms | 7 |

Thresholds, not a lookup on the seven current values — adding a `0.75x` to
`TELEPROMPTER.speeds` then lands somewhere sensible instead of a default.

## 6. Worklets

**Every entry in `haptics.ts` carries `'worklet'`.** Pulsar's presets are
worklets; a wrapper that was not could not be called from a gesture handler,
and the swipe, dial and flip gestures all fire straight from the UI thread —
a hop through JS lands the feedback a frame or two late. A worklet is still
callable from JS, so marking them all costs nothing.

Do not add an entry without the directive.

Beware of adding a `useSharedValue` to an existing hook that takes SharedValues
as arguments: it makes the React Compiler lint analyse the function and flag
its (legitimate) argument mutations as errors. `useSwipeGesture` takes its
`crossed` latch from the screen for exactly this reason.

## 7. Adding one

1. Is it already in the vocabulary? Use that name.
2. Is it a new *kind* of event? Add a semantic name to `haptics.ts` — not a
   `Presets.*` call in a screen.
3. Picking a preset: read the real pattern data in
   `ios/Pods/PulsarHaptics/Sources/Pulsar/Presets/Generated/`. Peak amplitude
   and event count are there in plain numbers. Do not choose by the name — the
   metadata cannot tell you how it feels, and neither can the word "thunder".
4. Hot path (a gesture, a list)? Add it to `PRELOAD` in `haptics.ts`.
   `preloadPresets` parses the pattern once and turns Pulsar's cache on;
   without it, every play rebuilds and re-parses.
5. Run the check, then feel it on hardware.

## 8. Checks

```bash
node scripts/check-haptics.mjs   # tier/palette/haptic invariants
npx tsc --noEmit                 # types
npx expo lint                    # must stay at 0 errors
```

`check-haptics.mjs` reads the thresholds, palettes and tier ladder out of the
source rather than restating them, and asserts: every tier has both a palette
and a haptic; the colour ramp stays monotonic (lightness falling, saturation
rising); and card text clears 3:1 on every shade — ScriptLine derives it as
`darken(0.4).desaturate(0.3)` at 30pt, which WCAG counts as large text. The
palette this replaced failed both the ramp check and, at tier 2 (2.05:1), the
contrast one.

**A simulator cannot validate feel.** It has no Taptic Engine; you get the
audio simulation and timing, not the sensation. Anything touching the weight
ladder or the card tiers has to be felt on a real device.

## 9. Preferences

`emotionHapticsEnabled` drives `Settings.enableHaptics` globally via
`startHapticsSync` (called once in `app/routes/_layout.tsx`). That is the
single gate — do not add per-call-site checks, and do not force a support
level in production.
