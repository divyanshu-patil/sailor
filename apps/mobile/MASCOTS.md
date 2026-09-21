# Mascot Inventory

Every place in `app/screens/` that has, or should have, a mascot. The mascot is the orange flower character from `assets/images/temp-mascot-1.png` / `assets/no-results.png`.

Runtime: `app/components/ui/mascot.tsx` plays a `.lottie` through the dotLottie state machine. New animations should be **states in a `.lottie` file driven by inputs**, not separate video-like clips. That way one file covers a whole screen's states.

Legend: **P0** = a space is already reserved in code · **P1** = empty, error or loading state that is currently plain text or a spinner · **P2** = extra context or delight

---

## 1. Screens with a slot already reserved (P0)

| # | Screen / file | Current state | Mascot animation |
|---|---|---|---|
| 1 | **New script: step 1 (description)**<br>`presentation/new-script/step-1-description.tsx` | ✅ Done: `watching.lottie` (`watching` ↔ `observe` via `isTyping`) | Optional extra: an `excited` state (bounce, sparkle eyes) when the text crosses a "good brief" length or an attachment is added. |
| 2 | **Script generation overlay** (used on both *preview* and *results*)<br>`presentation/generation/preview/components/generating/index.tsx` (says "mascot goes here too.") | Only a Stop / Try again button | **`generating.lottie`** with a `status` input:<br>• `generating`: loop of the mascot writing or scribbling on a notepad, petals bobbing<br>• `failed`: pencil snaps, then it slumps with a squiggle thought-bubble (same pose as `no-results.png`)<br>• `cancelled`: puts the pencil down and gives a small shrug or wave<br>• `completed`: jumps up with a "ta-da" and sparkles (one-shot, hand off before the overlay unmounts) |
| 3 | **Deck (cards) generation**<br>`presentation/generation/results/index.tsx` | Uses the same overlay as #2, so there's no card-specific visual | Same file as #2 with a `subject=deck` input: **shuffling or dealing cards** loop instead of writing, and a **fanning cards out** reveal on completion. |
| 4 | **Legacy results overlay**<br>`presentation/generation/results/components/generating/index.tsx` | 200×200 circle with a 🎴 emoji placeholder | ⚠️ **Not imported anywhere.** It's dead code, so delete it instead of animating it. #3 covers this case. |
| 5 | **Auth landing**<br>`auth/base.tsx` | `temp-mascot-1.png` (static hero) | **`hero.lottie`**: idle loop with the mascot waving and the friends/props around it slowly floating. A `wave` one-shot on mount, then idle breathing. |
| 6 | **Profile header**<br>`profile/components/profile-header-art.tsx` | `cloud_mascot.svg` (static, rotated 15°) | **Floating on the cloud**: slow bob and sway loop. Optional state for a pro subscriber: a crown or glow (the `plan-card` already knows the entitlement). |
| 7 | **Home: pull-to-refresh**<br>`presentation/decks/view-all-scripts/index.tsx` | `smiling.svg` scaled by scroll offset | **`pull.lottie` scrubbed by progress** (set frame from `scrollY`, don't loop): peeks up → eyes widen → arms raised at the threshold. Release plays a quick "spin". |
| 8 | **Search: start**<br>`presentation/decks/search/start-searching.state.tsx` | `start-search.png` (static, full art) | **Searching**: holds a magnifying glass and looks left and right in a loop. It could use `observe` while the user is typing, the same idea as #1. |
| 9 | **Search: no results**<br>`presentation/decks/search/no-results.state.tsx` | `no-results.png` (static; the mascot is sitting sad) | **Sad sit**: blinks, the squiggle thought-bubble spins, and a small sigh every few seconds. Copy stays in RN text so the `query` stays dynamic (the PNG has the query baked in). |

---

## 2. Empty, error and loading states that need one (P1)

| # | Screen / file | Current state | Mascot animation |
|---|---|---|---|
| 10 | **Home: no scripts yet**<br>`view-all-scripts/index.tsx` (`!decks.length`) | Plain text "No scripts yet." | **Empty notebook**: the mascot sits on a blank page and taps it, then points toward the "New Script" button (top right). This is the most important empty state because it's the first thing a new user sees. |
| 11 | **Home: load error**<br>`view-all-scripts/index.tsx` (`error && !decks`) | Plain error text | **Disconnected**: holds an unplugged cable or a cloud with a lightning bolt, looking confused. Reuse it across all network errors (#13, #16, #19). |
| 12 | **Discover: nothing published / no match**<br>`discover/index.tsx` | SwiftUI `ContentUnavailableView` (sparkles / magnifyingglass) | • Nothing published: **looking through a telescope** at an empty horizon (fits the Sailors name)<br>• Filters match nothing: reuse **#9 sad sit** |
| 13 | **Discover: loading**<br>`discover/index.tsx` | `ActivityIndicator` | Optional small **telescope scan** loop. A spinner is fine here, so this one is low priority. |
| 14 | **Saved: nothing saved**<br>`discover/saved.tsx` | `ContentUnavailableView` (bookmark) | **Hugging an empty bookmark**, then looking up hopefully. The error case reuses #11. |
| 15 | **Practice: no cards**<br>`presentation/script-practice/index.tsx` (`cards.length === 0`) | Grey text "No cards in this script yet." | **Shuffling an empty deck**: turns its hands over and shrugs. |
| 16 | **Practice: loading cards**<br>same file | `ActivityIndicator` | Reuse **#3 dealing cards** loop (short). |
| 17 | **Practice: end of deck**<br>same file ("No Cards Left" text behind the stack) | Text only | **Celebration**: claps, confetti petals, bow. A one-shot when the last card is swiped, then idle smile. Best moment for a reward. |
| 18 | **Practice: recording**<br>`script-practice/components/RecordButton.tsx` area | Waveform only | Optional small **listening** pose (hand to ear, nods in time with input level). The level could drive a numeric input. P2 if it adds too much clutter. |
| 19 | **Profile: loading / failed**<br>`profile/index.tsx` | Spinner + "Getting your profile" / "Failed to fetch data" | Loading: the cloud mascot from #6 **fades in and bobs**. Failure: reuse **#11 disconnected**. |

---

## 3. Contextual and delight moments (P2)

| # | Screen / file | Current state | Mascot animation |
|---|---|---|---|
| 20 | **Onboarding: welcome**<br>`onboarding/welcome.tsx` | Blue "S" circle placeholder logo | **Hello**: jumps in from below, big wave, then idle. Replaces the placeholder logo. |
| 21 | **Onboarding: features**<br>`onboarding/features.tsx` | Emoji icons 🚀🔒⚡ | Small mascot poses per row: **riding a rocket** (`assets/rocket.svg` exists), **holding a lock**, **lightning pose**. Static SVGs are enough; animate only if the whole screen gets redesigned. |
| 22 | **Auth: verify code, wrong code**<br>`auth/verify.tsx` ("Oops! That's incorrect.") | Text only | Small **head shake / wince** one-shot next to the error, and a **thumbs-up** on success before the redirect. |
| 23 | **Auth: forgot password**<br>`auth/forgot-password.tsx` | TODO, not implemented | **Scratching its head**, then a **mail-sent** paper-plane throw once the link is sent. |
| 24 | **Signup steps (name → email → password)**<br>`auth/signup/step-*.tsx` | No art | Reuse **`watching.lottie`** from #1 (observes while typing). For the password step, add a **covering eyes** state while the password field is focused, which is the classic, well-liked pattern. |
| 25 | **Publish sheet: success**<br>`presentation/script-detail/publish/index.tsx` | Sheet just closes | **Megaphone or flag-raise** one-shot, shown as a toast or overlay after `router.back()`. |
| 26 | **Paywall**<br>`paywall/index.tsx` | RevenueCat dashboard UI | ❌ Skip in code. Put a static or Lottie mascot **in the RevenueCat paywall template** so it ships without an app release. |
| 27 | **Settings / Terms / Edit profile / Delete account** | — | ❌ No mascot needed. Exception: an optional **sad wave goodbye** on the delete-account confirmation (`profile/edit-profile/components/delete-account-section.tsx`). |

---

## 4. Asset list: what to actually make

Grouped so each file covers several screens.

| Asset | States / inputs | Used by |
|---|---|---|
| `watching.lottie` ✅ | `watching`, `observe` (`isTyping`) (+ `excited`, `coverEyes` to add) | 1, 8, 24 |
| `generating.lottie` | `status`: generating / failed / cancelled / completed · `subject`: script / deck | 2, 3, 16 |
| `hero.lottie` | `wave` (one-shot) → `idle` | 5, 20 |
| `cloud-float.lottie` | `idle` bob, `pro` variant | 6, 19 (loading) |
| `pull.lottie` | Frame scrubbed by pull progress, `release` one-shot | 7 |
| `empty.lottie` | `noScripts`, `noResults` (sad sit), `noSaved`, `noCards`, `nothingPublished` (telescope) | 9, 10, 12, 14, 15 |
| `error.lottie` | `disconnected` | 11, 12 (error), 14 (error), 19 |
| `celebrate.lottie` | `celebrate` one-shot → `smile` idle; `publish` variant | 17, 25 |
| `reactions.lottie` (small) | `shake`, `thumbsUp`, `headScratch`, `mailSent`, `goodbye` | 22, 23, 27 |

**Minimum set to cover all P0 and P1 items:** `generating`, `empty`, `error`, `celebrate`, plus converting the existing statics (`hero`, `cloud-float`, `pull`). That's 7 files, one of which already exists.

Notes
- One-shots that end right before an unmount (#2 `completed`, #22 success) need the unmount delayed until the machine's `onStateMachineStateEntered` fires for the end state.
- Mascots on screens that sit off-screen in a stack or tab should pass `playing={false}` (see #1) so they don't burn frames.
- Respect Reduce Motion: show the first frame of the idle state and skip the loops.
