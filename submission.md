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
   script is pitched at you. Not quite right? Revise it to be softer or quieter, then
   create the deck.
2. **Practise it on colour-coded, haptic cards.** The script becomes a deck, one idea per
   card with its keywords and a delivery style. Each card also carries how hard the line
   should land, and you get that two ways at once. You **see** it: the card's colour runs
   from calm mint to peak coral, more vivid the harder it hits. You **feel** it: five impact
   tiers, each with its own haptic, played as the card arrives. Colour and touch give your
   memory two more hooks than the words alone, so you remember the rhythm of the talk, not
   just its sentences. Tap a card to flip it and read the full line, edit any card, then
   record yourself against the deck and play it back.

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
     break, with one streak restore a month. The widget's mascot greets you, sulks when your
   streak breaks, urges you to hurry when it's about to, and reacts to your thumb.
   Onboarding runs 20+ screens and is personalised to you.
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
- **The mascot**, who reacts to what you're doing, was animated in **Blooby
  (https://blooby-editor.vercel.app/), a mascot animation editor we built ourselves** for
  this project. It exports dotLottie files with
  their own state machines, which the app plays.

#### Our journey

We started in **May 2026**, the day RevenueCat announced the Shipaton. We're primarily
mobile developers, and that announcement was the push we needed. We began with basic design
prototypes in Figma and built from them, and every screen has evolved many times since. The
[Figma file](https://www.figma.com/design/jaDgU8OfnDAiENh3VyYzFi/Sailor-app?node-id=362-377&t=aU5SSI4NzCkZ4V3h-1)
holds every design, including the first rough ones.

We studied what makes a premium mobile app feel premium and added all of it: a mascot,
haptics, home-screen widgets, micro-interactions and gesture-based controls, so the app
feels natural under the thumb. Much of the UI is heavily inspired by apps we studied on
Mobbin.

The last three weeks were the hardest. The app wasn't complete, the MVP was unfinished, our
college schedule was tight, and we were stuck trying to animate the mascot in After Effects.
We got so frustrated that we built our own mascot editor, **[Blooby](https://blooby-editor.vercel.app/)**.
Every piece of artwork in Sailors is now made with it. Then we hit a new problem: lots of
Lottie files were heavy on performance, so we moved from standard Lottie playback to
Skia-based Lottie rendering. We still finished on the deadline.

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

- **Source code:** https://github.com/divyanshu-patil/sailors (README has screenshots of the home screen, onboarding, script setup, script detail, practice, widgets and streak/restore states)
- **TestFlight / App Store:** not required for the Next Gen Award (video + source code).
  <!-- TODO: add a TestFlight link only if one exists -->
- **Next Gen judging:** the repo is public and open source under its LICENSE; setup is in
  CONTRIBUTING.md.
- **Demo video:** https://youtube.com/shorts/uoi3QuBXQ8s
- **Build in public:** https://x.com/okkdiv · https://www.linkedin.com/in/divyanshupatil/
- **Mascot editor (Blooby):** https://blooby-editor.vercel.app/

---

## Devpost checklist (from the Shipaton page)

Deadline: **Oct 1, 2026, 12:00pm PDT**. Entering the **Next Gen Award** (students): a video
and open source code are submitted instead of a published store app, and no paid developer
account is needed. Requires a .edu (or equivalent) email.

- [x] Text description (this file)
- [x] Demo video on YouTube: https://youtube.com/shorts/uoi3QuBXQ8s (max 2 min, shows the app running on a device)
- [x] Source code: https://github.com/divyanshu-patil/sailors (public, open source)
- [x] Both team members are students
- [x] App icon, 1024×1024: `docs/submission/sailors-icon-1024.png`
- [x] Screenshots, all 1179×2556, no device frame: `apps/mobile/assets/screenshots/` (also shown in the README)
- [x] Monetization access for judges: RevenueCat Test Store, so purchases are free and unlock premium (see notes)
- [x] RevenueCat SDK integrated (paywall, entitlements, customer centre; see notes below)

---

## Additional notes for the judges

- **iOS only.** Sailors targets iOS 17+ and relies on SwiftUI components, a WidgetKit widget
  and system materials. Please test it on an iPhone or the iOS simulator.
- **There is no free tier, by design.** Every script and card deck is real model work, so
  one subscription (**Wave** monthly or **Voyager** annually) unlocks everything with no
  credits or limits. Discover (browsing public decks) is free with no plan, so you can
  explore without paying.
  **Judge access:** the app uses RevenueCat's **Test Store**, so no real money is involved.
  Tap a plan on the paywall and the test purchase completes instantly and unlocks
  everything, including the entitlement-gated features.
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
- **We built our own mascot editor, Blooby.** Every mascot animation in Sailors was made in
  Blooby, a motion-design editor for mascots that exports Lottie/dotLottie, rather than
  pulled from an asset pack. We built it after struggling to animate the mascot in After
  Effects. Try it: https://blooby-editor.vercel.app/
- **Build in public:** we posted regularly through the build on X (https://x.com/okkdiv) and
  LinkedIn (https://www.linkedin.com/in/divyanshupatil/).
- **Designs:** https://www.figma.com/design/jaDgU8OfnDAiENh3VyYzFi/Sailor-app?node-id=362-377&t=aU5SSI4NzCkZ4V3h-1
- **Built by two people:** Divyanshu Patil and Bhavesh More, from May (the day the Shipaton was announced) to September 2026, alongside college.

---

## YouTube video description

**Title:** Sailors: practise public speaking with haptic flashcards | RevenueCat Shipaton 2026

```
Public speaking is a must-have skill, and most people never really learn it.

Sailors is an iPhone app that takes you from "I have to talk about this on Thursday" to actually doing it:

• Generate a script from a description, images or a PDF. Set the audience, mood, card count and duration, and revise it to be softer or quieter.
• Practise on colour-coded flash cards with haptics: the harder a line should land, the more vivid the card and the stronger the vibration. Flip to see the full line, edit any card.
• Deliver with the teleprompter: custom speed, hold the left or right edge for 2x.
• Build the skill daily with short talks based on 21+ communication frameworks (PREP, STAR, SCQA and more).
• Streaks with a playful mascot and widgets. It greets you, gets sad when your streak breaks, and hurries you when it's about to. You can always restore it.
• 20+ screen personalised onboarding and haptics throughout.

The mascot is animated in Blooby, a mascot editor we built ourselves: https://blooby-editor.vercel.app/

Built with RevenueCat (paywall, entitlements, customer centre), Expo, OpenRouter, Sentry, Software Mansion (Reanimated, Pulsar haptics) and more.

Source code: https://github.com/divyanshu-patil/sailors
Designs: https://www.figma.com/design/jaDgU8OfnDAiENh3VyYzFi/Sailor-app?node-id=362-377
Follow the build: https://x.com/okkdiv · https://www.linkedin.com/in/divyanshupatil/

Made by Divyanshu Patil and Bhavesh More for the RevenueCat Shipaton 2026 (Next Gen Award).

#RevenueCatShipaton #ReactNative #Expo #PublicSpeaking #BuildInPublic
```
