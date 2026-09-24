# Contributing to Sailors

Thanks for being here. This document is the technical half of the project — the
[README](README.md) explains what Sailors is, this explains how to build it, how it is put
together, and what a good pull request looks like.

**Sailors is an iOS app.** You need a Mac with Xcode to run it. There is no Android or web
target today, and a contribution that only builds on Android is not something we can merge
yet.

---

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Prerequisites](#prerequisites)
- [Repository layout](#repository-layout)
- [First run](#first-run)
- [Environment variables](#environment-variables)
- [Everyday commands](#everyday-commands)
- [How the app fits together](#how-the-app-fits-together)
- [Code conventions](#code-conventions)
- [Mascots and animation](#mascots-and-animation)
- [Testing and checks](#testing-and-checks)
- [Commits and pull requests](#commits-and-pull-requests)
- [Troubleshooting](#troubleshooting)

---

## Ways to contribute

- **Fix a bug.** Open an issue first if it is not obvious, so nobody duplicates the work.
- **Take an issue.** Anything labelled `good first issue` is fair game; comment to claim it.
- **Improve the writing.** Copy in the app, comments in the code, these docs.
- **Add a mascot state.** See [Mascots and animation](#mascots-and-animation).
- **Propose a feature.** Open a discussion before building something large. We would rather
  talk about a screen for ten minutes than decline a week of work.

Be decent to each other. Assume the person on the other side of the review is trying to
make the same thing good.

---

## Prerequisites

| Tool | Version | Why |
| :-- | :-- | :-- |
| **macOS + Xcode** | Xcode 16+ (26 is what we build with), iOS 17+ simulator | The only supported target |
| **Node** | 18 or newer | Metro, Expo CLI, tooling |
| **pnpm** | 11.13.1 (pinned via `packageManager`) | Workspace package manager |
| **Python** | 3.14+ | The API |
| **uv** | latest | Python dependency and venv management |
| **Docker** | latest | Redis for local development |
| **CocoaPods** | latest | Installed by the Expo prebuild step |

```bash
# If you are missing any of them
brew install node pnpm uv docker cocoapods
xcode-select --install
```

You will also need free accounts for the services the app talks to:
[Clerk](https://clerk.com) (auth), [Supabase](https://supabase.com) (Postgres) and at least
one model provider — [OpenRouter](https://openrouter.ai/) has a free tier and is what the
backend reaches for first. [RevenueCat](https://www.revenuecat.com/) and
[Sentry](https://sentry.io/) are optional: without their keys, billing and crash reporting
turn themselves off instead of breaking the app.

---

## Repository layout

```
sailor/
├── apps/
│   ├── mobile/                 # The iPhone app — Expo SDK 57, React Native 0.86
│   │   ├── app/
│   │   │   ├── routes/         # Expo Router file-based routes (the URL map)
│   │   │   ├── screens/        # The actual screens, one folder per feature
│   │   │   ├── components/     # Shared UI
│   │   │   ├── hooks/          # Data hooks — useDeck, useDecks, useSubscription…
│   │   │   ├── store/          # Zustand stores (persisted with MMKV)
│   │   │   ├── db/             # SQLite schema, repositories, mappers
│   │   │   ├── services/       # HTTP clients for the API
│   │   │   ├── lib/            # Purchases, notifications, widget sync, config
│   │   │   ├── widgets/        # iOS home-screen widget views
│   │   │   └── utils/
│   │   ├── assets/             # Fonts, mascots, widget art, the app icon
│   │   ├── ios/                # Native project (committed — see below)
│   │   └── app.json            # Expo config and plugins
│   └── backend/                # FastAPI service
│       ├── app/
│       │   ├── api/v1/         # Routers
│       │   ├── controllers/    # Request logic
│       │   ├── services/       # AI pipeline, decks, cards, daily, storage
│       │   ├── models/         # SQLAlchemy models
│       │   ├── schemas/        # Pydantic schemas
│       │   ├── tasks/          # Celery tasks
│       │   └── config/         # Settings
│       ├── migrations/         # Alembic
│       ├── tests/
│       └── docker-compose.yml  # Redis
└── turbo.json                  # Task graph
```

> **`apps/mobile/ios` is committed.** The project uses config plugins and a custom widget
> target, so the native project is checked in rather than generated on every clone. Run
> `npx expo prebuild -p ios` only when you change `app.json`, add a config plugin, or add a
> native dependency — and commit the result.

---

## First run

```bash
# 1. Clone and install. The postinstall hook runs `uv sync` for the backend,
#    so this one command sets up both apps.
git clone https://github.com/divyanshu-patil/sailor.git
cd sailor
pnpm install

# 2. Create the two env files from the examples, then fill in your keys
#    (the next section explains every variable)
cp apps/mobile/.env.example apps/mobile/.env
cp apps/backend/.env.example apps/backend/.env

# 3. Start Redis
cd apps/backend && docker compose up -d && cd ../..

# 4. Apply database migrations
pnpm db:update

# 5. Build and run everything — the API, the Celery worker and the iOS app
pnpm dev:ios
```

The first iOS build compiles the native project and takes a while. Afterwards
`pnpm dev:ios` reuses it and starts in seconds.

---

## Environment variables

### `apps/mobile/.env`

| Variable | Required | Notes |
| :-- | :-- | :-- |
| `EXPO_PUBLIC_API_URL` | ✅ | Your backend, e.g. `http://localhost:3000/`. On a physical device use your Mac's LAN IP, not `localhost`. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk dashboard → API keys |
| `EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID` | — | Google sign-in |
| `EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME` | — | Google sign-in |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | — | Without it, purchases are disabled rather than broken |
| `EXPO_PUBLIC_SENTRY_DSN` | — | Without it, Sentry stays off |

Everything the app reads goes through `app/lib/config/env.ts`, which throws on a missing
*required* variable at import. Add new variables there rather than reading
`process.env` from a screen.

### `apps/backend/.env`

| Variable | Required | Notes |
| :-- | :-- | :-- |
| `DATABASE_URL` | ✅ | Postgres connection string (Supabase or local) |
| `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | ✅ | `redis://localhost:6379/0` with Docker running |
| `CLERK_SECRET_KEY`, `CLERK_JWT_PUBLIC_KEY` | ✅ | Verifies the app's tokens |
| `CLERK_WEBHOOK_SIGNING_SECRET` | ✅ | Clerk → webhooks, verified with Svix |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-side only. Never put these in the app. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | ✅ | S3 bucket for recordings and attachments. `AWS_REGION` must match the bucket's region. |
| `AI_PROVIDER` | ✅ | `ollama` (the default — runs locally, no key), `anthropic`, `openai`, `groq`, `gemini` or `openrouter` |
| `OPENROUTER_API_KEY`, `AI_USE_OPENROUTER`, `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL` | — | On by default; free models are tried first and fall through to `AI_PROVIDER` |
| `OPENAI_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OLLAMA_HOST` | — | Whichever provider you configured |
| `REVENUECAT_API_KEY`, `REVENUECAT_ENTITLEMENT_ID` | — | Server-side entitlement checks |
| `FREE_MONTHLY_GENERATIONS`, `PRO_MONTHLY_GENERATIONS` | — | Both default to `-1`, meaning unlimited — usage is counted, nothing is refused. A positive number puts a cap back on with no code change. |
| `DAILY_PRACTICE_ADMIN_SECRET` | — | Guards the daily-content refill endpoint |

All of them are declared with defaults and comments in `apps/backend/app/config/settings.py`
— read that file rather than guessing.

---

## Everyday commands

From the repository root:

| Command | What it does |
| :-- | :-- |
| `pnpm dev:ios` | API + Celery + Docker + the iOS app, all at once |
| `pnpm ios` | Just the iOS app |
| `pnpm run:backend` | Just the API, the worker and Docker |
| `pnpm db:update` | `alembic upgrade head` |
| `pnpm lint` | Lint every workspace |
| `pnpm format` | Prettier across the repo |
| `pnpm quota` | Inspect and adjust a user's generation quota |
| `pnpm practice:regenerate` | Regenerate the pre-built daily practice content |

Inside `apps/mobile`:

| Command | What it does |
| :-- | :-- |
| `pnpm ios` | `expo run:ios` |
| `pnpm start` | Metro only, against an existing build |
| `npx tsc --noEmit` | Type-check |
| `npx expo lint` | Lint |
| `npx expo prebuild -p ios` | Regenerate the native project after a config change |

Inside `apps/backend`:

| Command | What it does |
| :-- | :-- |
| `pnpm dev` | Docker + `fastapi dev` on port 3000 |
| `pnpm celery` | Worker and beat together, all queues |
| `pnpm celery:scripts` / `:cards` / `:maintenance` | One queue at a time |
| `uv run alembic revision --autogenerate -m "..."` | New migration |

---

## How the app fits together

**Offline-first, everywhere.** Screens read from SQLite and render on the first frame, then
a network request refreshes the cache and the UI follows. The pattern is always
service → hook → SQLite → UI; see `app/hooks/use-deck.ts` for the canonical version. If you
are adding a screen that fetches something, copy that shape rather than calling a service
directly from a component.

**Generation is a background job.** Script and card generation are Celery tasks on the
`scripts` and `cards` queues. The app enqueues, then polls or listens; it never waits on a
model call in a request. Daily practice content is generated days ahead by a scheduled task
for the same reason.

**The model layer is pluggable.** `app/services/ai/providers/` holds one adapter per
provider. OpenRouter sits *in front* of the configured provider and falls through to it when
the free budget is spent — it is a switch (`AI_USE_OPENROUTER`), not a separate
`AI_PROVIDER` value.

**Entitlement has one source of truth.** `store/subscription.store.ts` is the only place
that decides whether a user is Pro, and it is written only from RevenueCat customer info.
Never derive access from anything else.

**Animation runs on the UI thread.** Reanimated shared values and worklets, not
`setState` in a loop. A screen that animates while scrolling should not be re-rendering
while it does so.

---

## Code conventions

- **TypeScript everywhere**, no `any` that you could have typed.
- **Comments explain _why_, never _what_.** The code already says what it does. A comment
  earns its place by recording the constraint, the bug, or the alternative that did not
  work. This codebase is written that way; please match it.
- **Reuse before you add.** There is probably already a `PressableScale`, a `ShimmerBar`, a
  `HandwrittenNote`, a date helper. Look before writing a second one.
- **Do not add a dependency** for something a few lines of code can do. If you genuinely
  need one, say why in the pull request.
- **File naming** follows whatever the folder already does — `kebab-case.tsx` in newer
  folders, `PascalCase.tsx` in older ones. Consistency inside a folder beats consistency
  across the repo.
- **Tunable numbers live in a config object**, not scattered through a component. See
  `screens/presentation/teleprompter/config.ts` for the pattern: every duration, gap and
  speed in one place with a comment on each.
- **Native modules and config plugins** require a prebuild and a rebuild. Call that out in
  the pull request so reviewers know they cannot just pull and run.

---

## Mascots and animation

The mascot is a real part of the product, not decoration — it reacts to the state the user
is in. There is an inventory of every place that has, or should have, a mascot in
[`apps/mobile/MASCOTS.md`](apps/mobile/MASCOTS.md).

**[Blooby](https://blooby-editor.vercel.app/) is the primary source for mascot art in this
project.** New poses and animations should be authored there and exported as
Lottie / dotLottie:

1. Build the character's states in [Blooby](https://blooby-editor.vercel.app/) — prefer one
   file with several states driven by inputs over several one-shot clips. A single file can
   then cover a whole screen.
2. Export as `.lottie`.
3. Drop it in `apps/mobile/assets/animations/mascots/` and play it through
   `components/ui/mascot.tsx`.
4. Keep the placeholder's box and baseline. The SVG stand-ins in the codebase (for example
   `screens/streak-restore/scenes.tsx`) each take a `width` and derive everything else, so a
   Lottie of the same proportions drops straight in without touching the layout.

Widgets are the exception: a home-screen widget can render neither SVG nor Lottie, so
widget art is baked to PNG by `apps/mobile/scripts/mascots/bake-icons.mjs`.

---

## Testing and checks

Run these before opening a pull request. There is no CI gate yet, so the review is the gate.

```bash
# Mobile — types and lint must both be clean
cd apps/mobile
npx tsc --noEmit
npx expo lint

# Backend — 105 tests, no database needed, they stub it
cd ../backend
uv run python -m unittest $(ls tests/test_*.py | sed 's|/|.|;s|\.py$||')
```

**What we test.** Pure, branchy logic that can be quietly wrong: streak arithmetic on a
date boundary, quota counting, attachment extraction, the OpenRouter fallback, script
revision. Not queries, and not model calls.

Some standalone modules carry their own runnable check instead of a test file — for example
`apps/mobile/app/screens/presentation/teleprompter/sentences.ts`, which you can execute
directly:

```bash
node apps/mobile/app/screens/presentation/teleprompter/sentences.ts
```

If you add non-trivial logic — a parser, a date calculation, anything to do with money or
entitlement — leave one runnable check behind. One assert that fails when the logic breaks
is worth more than a suite of tests for getters.

---

## Commits and pull requests

**Commits.** Write the message for whoever has to understand the change in six months.
A subject line that says what changed, and a body that says why, what the alternative was,
and anything surprising. Look at `git log` for the standard.

**Pull requests.** The repository has a
[template](.github/PULL_REQUEST_TEMPLATE.md) — fill it in:

- What you changed and why.
- How to test it, including which screens to look at.
- Screenshots or a screen recording for anything visual. This is a design-led app; a
  reviewer should not have to build the branch to see what you did.
- Tick the checklist honestly. An unticked box is fine; a wrongly ticked one is not.

**Before you push:** types clean, lint clean, tests passing, no stray `console.log`, no
commented-out code, no secrets. Migrations must be reversible and committed with the model
change that needs them.

---

## Troubleshooting

<details>
<summary><b>The app builds but everything is empty / requests fail</b></summary>

`EXPO_PUBLIC_API_URL` is probably pointing at `localhost` from a physical device. Use your
Mac's LAN IP. Check the API is actually up: `curl $EXPO_PUBLIC_API_URL/health`.
</details>

<details>
<summary><b>A script never finishes generating</b></summary>

The Celery worker is not running, or it is not consuming the right queue. `pnpm celery`
runs the worker and beat across `scripts`, `cards` and `maintenance`. Check Redis is up:
`docker compose ps`.
</details>

<details>
<summary><b>`Missing required env var: ...` on launch</b></summary>

`app/lib/config/env.ts` throws at import for a required variable. Add it to
`apps/mobile/.env` and restart Metro — env changes are read at bundle time, so a Fast
Refresh will not pick them up.
</details>

<details>
<summary><b>Native build fails after pulling</b></summary>

Someone changed `app.json`, a config plugin or a native dependency:

```bash
cd apps/mobile
npx expo prebuild -p ios --clean
pnpm ios
```
</details>

<details>
<summary><b>Pods or Metro are in a bad state</b></summary>

```bash
cd apps/mobile
rm -rf ios/Pods ios/build
npx expo prebuild -p ios --clean
pnpm start --clear
```
</details>

<details>
<summary><b>Purchases do nothing in the simulator</b></summary>

Expected without a RevenueCat key — the app disables billing rather than crashing. With a
key, use RevenueCat's Test Store; note that its subscriptions renew on compressed cycles,
so a "monthly" plan can expire minutes after purchase. The profile card marks those with
`· test` in development builds.
</details>

---

## Licence

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers this project.
