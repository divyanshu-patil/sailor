# Sailors: RevenueCat Shipaton 2026 submission

---

## Elevator pitch

> Sailors makes you a better public speaker: it writes your script, drills it on colour-coded haptic cards, and teaches speaking patterns like PREP and STAR in 2-minute daily talks.

---

## Project Story

### About the project

#### What inspired us

Almost every career has a moment that turns on five minutes of talking: a pitch, a demo, a
standup that suddenly matters, a wedding toast. Most people prepare for those five minutes
the same way. They write something the night before, read it twice, and hope.

When we looked at the tools people use, each one solved a third of the problem:

- **A chatbot** will write you a script, then leave you alone with it.
- **A teleprompter** will scroll text at you, but it doesn't care whether you've ever said
  the words out loud.
- **A course** teaches theory on a Tuesday that you can't recall on the Friday you need it.

Nobody owned the loop. Writing, rehearsing and delivering a talk are one job, and getting
better at public speaking comes from doing that loop again and again. So we built **Sailors**:
one iPhone app that takes you from *"I have to talk about this on Thursday"* to standing up
and doing it, with the daily reps in between that make every talk after it easier.

#### What it does

The MVP is two steps, plus a daily habit that builds the skill underneath them.

1. **Generate a presentation script.** Describe the talk in a sentence, attach the brief or
   the PDF you were handed, and set the length, audience and mood. Sailors writes a
   structured script (beats like `[HOOK]` and `[CORE MESSAGE]`, stressed phrases,
   written-in pauses). You tell it your profession and speaking experience once, and every
   script is pitched at you.
2. **Practise it on colour-coded, haptic cards.** The script becomes a deck, one idea per
   card with its keywords and a delivery style. Each card also carries how hard the line
   should land, and you get that two ways at once. You **see** it: the card's colour runs
   from calm mint to peak coral, more vivid the harder it hits. You **feel** it: five impact
   tiers, each with its own haptic, played as the card arrives. Colour and touch give your
   memory two more hooks than the words alone, so you remember the rhythm of the talk, not
   just its sentences. Then record yourself against the deck and play it back.

Around that core:

3. **Learn the patterns with daily practice.** Most speaking isn't a prepared talk. It's a
   question in a meeting, an interview answer, "so, what do you do?", and there's no script
   for those. What helps is a pattern you can pour any content into. So every day Sailors
   gives you one **two-minute talk built on a named public-speaking framework** from a
   library of 22 (PREP, STAR, SCQA, AIDA, the Golden Circle, Feynman and more). First you
   see the framework's steps and when to use it, then you read a short talk that applies it
   to a real topic out loud, line by line, then you get one delivery tip.

   Why it helps:
   - **Patterns, not pep talks.** "Be more confident" can't be practised. "Answer first,
     then one reason, one example, and the point again" (PREP) can, and after a few reps
     it's how you answer without thinking.
   - **One shape, many rooms.** Each framework returns every 22 days in a different
     situation it suits (an interview one time, a conference Q&A the next), so you learn
     *when* to reach for a pattern, not just what it is.
   - **Small enough to keep doing.** Two minutes fits a coffee queue. Streaks live on the
     home screen, in an iOS widget, and in reminders timed to the minute your streak would
     break, with one streak restore a month.
   - **It feeds the core.** Once you know the shapes, you spot them in the scripts Sailors
     writes, and when a Q&A pulls you off-script, you have a structure ready.

4. **Deliver with the teleprompter.** Autoscroll from 0.25× to 3×. Hold the middle to pause,
   hold an edge to run at double speed, and drag back to re-read. A stopwatch sits on the
   button so you know if you're running long.
5. **Learn from others in Discover.** Publish a deck and anyone can read the script,
   practise the cards and save it. Discover is free, with no plan needed.

#### How we built it

Sailors is a Turborepo monorepo with two apps.

- **The iPhone app** (`apps/mobile`) is Expo SDK 57 and React Native 0.86 in TypeScript,
  using Expo Router. It feels native because it is native where it counts: SwiftUI
  components through `@expo/ui`, a WidgetKit home-screen widget, system materials, and
  real native navigation and toolbars. Motion runs on Reanimated, drawing on Skia, and
  haptics on Software Mansion's Pulsar.
- **The API** (`apps/backend`) is FastAPI on Python 3.14 with SQLAlchemy and Alembic over
  Postgres (Supabase). Script and card generation run as Celery jobs on Redis, so no
  request ever waits on a model. Recordings and attachments go to S3.
- **Models** go through OpenRouter in production. Ollama is the default for development,
  so the whole pipeline runs on a laptop with no API key. Anthropic, OpenAI, Gemini and
  Groq plug in behind the same adapter.
- **Identity** is Clerk. **Subscriptions, the paywall and the customer centre** are
  RevenueCat. **Errors** go to Sentry.
- **The mascot**, who reacts to what you're doing, is animated in Blooby and shipped as
  dotLottie files with their own state machines.

#### Challenges we ran into

**Long AI jobs on a phone.** Generating a script takes long enough that people leave the
screen, lock the phone, or tap back by accident. Early on, backing out killed the job and
threw away a script the user had been waiting for. We rebuilt generation as a server-side
resource. Leaving a screen no longer cancels anything, and coming back re-attaches to the
running job. Pressing Generate again with an unchanged brief resolves to the generation
that already exists instead of paying for an identical one. A deck is only written once all
its cards exist, so an empty deck never flashes into your grid.

**Making cards you can remember by.** The first version of the card colours bucketed each
deck by rank, so exactly a fifth of every deck came out as a scarlet "climax" card, even a
deck of uniformly calm lines. That was harmless when colour was only decoration. Once the
same number decided how hard the phone vibrates in your hand, it was actively misleading.
We switched to absolute thresholds on the generator's impact score (and told the model to
save scores above 0.8 for genuine peaks), so a quiet deck now looks and feels quiet. We also
rebuilt the palette in OKLCH, where equal steps look equally different, so a stronger line
is always a visibly more vivid card. Five tiers, five colours, five distinct haptics, all
from one number:

$$
\text{tier}(i) = \#\{\, \theta \in \{0.2,\ 0.4,\ 0.6,\ 0.8\} : i \ge \theta \,\}
$$

**Waiting that doesn't feel like waiting.** Even with jobs in the background, a screen that
waits on a network round trip before showing *anything* feels broken. We moved every job
kickoff behind the screen that reports on it, so tapping Create shows the loading state on
the same frame. While you wait, the mascot slides in with a public-speaking tip that stays
the same for that generation.

**Mascots at 60fps.** Our first mascot renderer gave every animation its own Metal view
and drew a fresh image on the main thread every frame. On a screen with seven mascots,
that cost us the frame rate. We moved them to Skia's Skottie, advanced frame by frame on
the UI thread. They stop drawing entirely when their screen is out of view, and we wrote
our own small interpreter for the dotLottie state machines. Some animations aren't played
at all but scrubbed by gestures. The pull-to-refresh mascot, for example, follows the pull
distance $d$ on a quintic curve, so it barely moves at first and rushes to the end:

$$
p = \left(\frac{\min(d,\ 80)}{80}\right)^{5}
$$

**Offline-first, including the launch.** Backstage wifi is a myth. Scripts, decks and cards
live in on-device SQLite, and streaks and preferences live in MMKV. Every screen renders
from disk on the first frame and refreshes from the network after. The app even starts
from disk when it can't reach its auth provider, which meant auditing every place that
assumed a network answer would come.

**Making a streak mean something.** A streak you can undo at any time was never a streak.
Getting restore right took several rewrites. It is offered only on the day the streak
breaks, the window closes 24 hours later, and reminders are scheduled against the exact
minute the streak dies, then rescheduled or cancelled as you practise.

#### What we learned

- **Structure is the skill that transfers.** Our first daily content was generic tips
  ("here is a tip about structure"), and it read as filler because there was nothing in it
  to apply. Rebuilding it around named frameworks, each with exact steps, the situations
  it fits and a worked example, made every rep something you can use the same afternoon.
- **Memory likes more than one sense.** Pairing each card's colour with a matching haptic
  turned rehearsal from rereading into something you can feel, and it forced us to make the
  impact score honest, because a vibration that lies is worse than none.
- **Perceived speed is a product feature.** The biggest wins came from showing the right
  screen immediately, not from making the backend faster.
- **Motion has a budget.** Every animation competes with scrolling for the same frame. We
  learned to measure first, then move work off the main thread or stop it when nobody's
  looking.
- **Native beats "native-looking".** Using SwiftUI controls and system materials directly
  took less code than imitating them, and they behave the way iPhone users expect.
- **Paywalls are product design.** With RevenueCat running plans, prices and the paywall,
  we could change our minds about pricing without shipping an app update. We chose no free
  tier and no credits: one plan opens everything, and Discover stays free for everyone.

#### What's next

- **Delivery feedback** on your recordings: pace, filler words and clarity.
- **Android**, once there are good equivalents for the native pieces the iOS app leans on.

---

## Built with

`react-native` · `expo` · `typescript` · `expo-router` · `swiftui` · `widgetkit` · `reanimated` · `skia` · `lottie` · `pulsar-haptics` · `fastapi` · `python` · `sqlalchemy` · `celery` · `redis` · `postgresql` · `supabase` · `sqlite` · `aws-s3` · `clerk` · `revenuecat` · `openrouter` · `ollama` · `sentry` · `turborepo`

<sub>25 tags. Also used but not tagged, if there's room to swap: Alembic, MMKV, Blooby (mascot animation), Anthropic / OpenAI / Gemini / Groq (alternative model providers), Mobbin (UI reference).</sub>

---

## "Try it out" links

- **Source code:** https://github.com/divyanshu-patil/sailors
- **TestFlight / App Store:** <!-- TODO: add the public TestFlight or App Store link -->
- **Demo video:** <!-- TODO: add the video link -->

---

## Additional notes for the judges

- **iOS only.** Sailors targets iOS 17+ and relies on SwiftUI components, a WidgetKit widget
  and system materials. Please test it on an iPhone or the iOS simulator.
- **There is no free tier, by design.** Every script and card deck is real model work, so
  one subscription (**Wave** monthly or **Voyager** annually) unlocks everything with no
  credits or limits. Discover (browsing public decks) is free with no plan, so you can
  explore without paying.
  <!-- TODO: if you're giving judges access (promo code, sandbox account, TestFlight), say how here. -->
- **RevenueCat does the billing end to end:** offerings, the paywall, entitlements that
  gate the app, and the customer centre for managing the plan. Plans and prices can change
  without an app update.
- **Running it yourself costs nothing.** The backend defaults to Ollama
  (`AI_PROVIDER=ollama`), so the full pipeline (brief in, script and practice cards out)
  runs locally with no API key. Setup is in
  [CONTRIBUTING.md](https://github.com/divyanshu-patil/sailors/blob/main/CONTRIBUTING.md).
- **Sponsor tools we actually used:** RevenueCat (billing), Expo (runtime, router, native
  modules, widgets), OpenRouter (production model routing), Sentry (crash and error
  monitoring), Software Mansion (Reanimated, Gesture Handler, Screens, Pulsar haptics), and
  Mobbin (the UI reference behind each screen).
- **Built by two people:** Divyanshu Patil and Bhavesh More, from May to September 2026.
