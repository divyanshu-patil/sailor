/**
 * Every word the app puts in a notification.
 *
 * Copy in one file, timing and permissions in theirs (daily-reminder.ts,
 * streak-alarm.ts).
 *
 * The voice: a Gen Z intern at a language-learning app, writing between
 * scrolls. Lowercase, a little unhinged, fluent in the group chat — but never
 * mean. It can be dramatic about a streak; it can't make someone feel bad. On
 * the streak ladder the numbers stay whatever the joke — hours left, days at
 * stake — because that's what someone acts on from a lock screen. And a streak
 * that already ended gets kindness, not a bit.
 *
 * Less repetitive by construction: large pools, and a pick keyed on the date
 * through a shuffle, so nothing comes round again until the whole pool has —
 * and rescheduling on launch doesn't reshuffle what's already queued.
 */

interface Line {
  title: string;
  body: string;
}

/**
 * The daily nudge, title and body written together — the joke usually lands
 * across both. `{name}` is the nickname; lines that use it are left out when
 * there isn't one.
 */
export const DAILY_REMINDERS: readonly Line[] = [
  { title: "pov: it's practice o'clock", body: "2 minutes of talking out loud. your future self is already clapping." },
  { title: "{name}, quick favour", body: "say two sentences out loud. that's it. that's the favour." },
  { title: "not to be dramatic but", body: "your voice has been on do not disturb all day. let it cook 🎤" },
  { title: "hey bestie 👀", body: "today's practice is 2 minutes and zero awkward eye contact. we checked." },
  { title: "this is your sign", body: "a whole notification telling you to practice. the universe is not being subtle." },
  { title: "main character moment", body: "main characters rehearse their monologue. just saying." },
  { title: "your mic misses you 🎙️", body: "it told us not to say anything. anyway. 2 minutes?" },
  { title: "{name}, this one's for you", body: "tiny speech, huge aura. go collect it." },
  { title: "brb stealing 2 minutes of your day", body: "fair trade: 2 minutes for sounding 10x more sure of yourself." },
  { title: "ok hear me out", body: "practice before the doomscroll instead of after. revolutionary, we know." },
  { title: "certified yapper energy", body: "put that yap to work. today's practice is ready." },
  { title: "you: \"i'll practice later\"", body: "later: this notification. hi 👋" },
  { title: "no cap, easiest win today", body: "open, talk, done. faster than your coffee order." },
  { title: "is it giving… confidence?", body: "it could be. 2 minutes and it's giving." },
  { title: "{name}, real talk", body: "speaking is a muscle. today is arm day, but for your mouth." },
  { title: "the blob is waiting 🫧", body: "it's been staring at the door. please. it's so small." },
  { title: "rate this notification 1–10", body: "10 if you tap it and practice. a 4 if you swipe it away. no pressure." },
  { title: "gentle reminder (aggressively)", body: "PRACTICE. (gently.) (2 minutes.)" },
  { title: "lowkey urgent, highkey easy", body: "today's drill takes about as long as reading this. ok, a bit longer." },
  { title: "delulu is the solulu 💅", body: "believe you're a great speaker. then practice so it's not delulu." },
  { title: "we saved you a seat 🪑", body: "front row at your own practice session. doors close at midnight." },
  { title: "spill the tea ☕", body: "out loud, for 2 minutes, with structure. that's literally the practice." },
  { title: "npc behaviour: skipping practice", body: "main character behaviour: tapping this. choose wisely." },
  { title: "{name} understood the assignment", body: "well, will have. after today's 2-minute practice." },
  { title: "friendly neighbourhood nudge", body: "today's practice is here and it's lowkey fun this time. trust." },
  { title: "hot take 🔥", body: "your best talk is 2 minutes of practice away. we'll wait." },
  { title: "not a drill (it's a drill)", body: "a speaking drill. 2 minutes. you've got this." },
  { title: "screen time report: 💀", body: "balance it out with 2 minutes of actually useful talking." },
  { title: "this could've been a meeting", body: "instead it's 2 minutes of practice that makes you better at meetings." },
  { title: "set sail ⛵", body: "captain {name}, today's practice is ready to board." },
  { title: "glow up, but make it verbal ✨", body: "2 minutes a day and people start asking what changed." },
  { title: "welcome to your rehearsal era", body: "today's episode runs 2 minutes. no ads." },
  { title: "tap in 🫶", body: "today's practice won't do itself. we asked. it refused." },
  { title: "{name}, the stage called", body: "it wants you ready. warm up with today's practice." },
  { title: "don't leave us on read 🥲", body: "2 minutes. that's all we're asking. pls." },
  { title: "stage fright hates this one trick", body: "the trick is practising every day. starting now, ideally." },
  { title: "sorry to interrupt the scroll", body: "not sorry. practice time 🎤" },
  { title: "your group chat could never", body: "2 minutes of structured talking. they're not ready for you." },
  { title: "vibe check ✅", body: "passing requires one (1) practice session. easy." },
  { title: "{name} rn: 🧍", body: "{name} after practice: 🕺 the difference is 2 minutes." },
  { title: "reminder that you ate yesterday", body: "(probably.) let's eat again. today's practice is up." },
  { title: "live from your notifications", body: "it's your daily practice, and it's taking questions (from you, out loud)." },
];

/**
 * The streak ladder, escalating toward the deadline, with a few ways to say
 * each rung so it isn't the same five lines every night. Offsets are relative
 * to the moment the streak resets; the last is positive, so it lands the next
 * morning and only survives if the user never came back to reschedule it.
 * `{n}` is the streak's length in days.
 */
export const STREAK_ALERTS: readonly {
  offset: number;
  lines: readonly Line[];
}[] = [
  {
    offset: -4 * 60 * 60 * 1000,
    lines: [
      { title: "🔥 {n}-day streak, 4 hours left", body: "one practice and it's safe. tap in before it gets dramatic." },
      { title: "your {n}-day streak is sweating rn", body: "4 hours to save it. literally one practice." },
      { title: "🔥 {n} days and counting?", body: "the counting stops in 4 hours unless you show up. no pressure (some pressure)." },
      { title: "psst… {n}-day streak check", body: "4 hours left. keep the streak era going." },
    ],
  },
  {
    offset: -2 * 60 * 60 * 1000,
    lines: [
      { title: "⏳ 2 hours left, bestie", body: "{n} days of practice, gone at midnight. unless… you know." },
      { title: "your streak just texted us 😭", body: "it said \"2 hours left\" and \"pls\". {n} days on the line." },
      { title: "⏳ 2-hour warning", body: "{n}-day streak, 2 hours, one practice. the math is mathing." },
      { title: "not the {n}-day streak 😰", body: "2 hours to save it. we believe in you (mostly kidding, fully)." },
    ],
  },
  {
    offset: -1 * 60 * 60 * 1000,
    lines: [
      { title: "🚨 1 hour until your streak resets", body: "your {n}-day streak hits zero at midnight. it takes a minute." },
      { title: "🚨 60 minutes on the clock", body: "{n} days are about to become 0. don't let it flop." },
      { title: "1 hour left and we're spiralling", body: "save the {n}-day streak. one practice. go go go." },
      { title: "🚨 your 1-hour call", body: "{n}-day streak, 60 minutes. you already know what to do." },
    ],
  },
  {
    offset: -15 * 60 * 1000,
    lines: [
      { title: "🚨 15 minutes. last call.", body: "{n} days about to disappear. go." },
      { title: "15 MINUTES 😭", body: "{n}-day streak. one tap. we're being dramatic so you don't have to be." },
      { title: "final boss: the clock ⏰", body: "15 minutes to save {n} days. you've got this." },
      { title: "it's giving… last minute 🫣", body: "15 minutes left on your {n}-day streak. sprint." },
    ],
  },
  {
    offset: 9 * 60 * 60 * 1000,
    lines: [
      { title: "💔 your {n}-day streak ended", body: "it happens. day one is genuinely the easiest. start another today?" },
      { title: "rip {n}-day streak 🕯️", body: "gone, not forgotten. new streak, who dis? it starts with today." },
      { title: "the streak ended, not the story", body: "{n} days proved you can. day one is right here." },
      { title: "we lost the {n}-day streak 🥲", body: "plot twist: comebacks are the best arc. start yours today." },
    ],
  },
];

const DAY_MS = 86_400_000;

/** A calendar day as a whole number, in the user's own time zone. */
const dayNumber = (date: Date) =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );

/** A small seeded generator (mulberry32), so a shuffle is repeatable. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The item for a given date: each run of `pool.length` days walks a fresh
 * shuffle of the pool, so nothing repeats within a run, and the same date
 * always gets the same item — however often it's rescheduled.
 */
export function pickForDay<T>(pool: readonly T[], date: Date, salt = 0): T {
  const day = dayNumber(date) + salt;
  const run = Math.floor(day / pool.length);
  const random = seeded(run * 2654435761 + salt);
  const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return pool[order[day - run * pool.length]!]!;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]));

/** The daily reminder for a date, with the nickname where a line uses one. */
export function dailyReminderFor(date: Date, nickname?: string | null): Line {
  const name = nickname?.trim() ?? "";
  const pool = name
    ? DAILY_REMINDERS
    : DAILY_REMINDERS.filter(
        (line) => !line.title.includes("{name}") && !line.body.includes("{name}"),
      );
  const line = pickForDay(pool, date);
  return { title: fill(line.title, { name }), body: fill(line.body, { name }) };
}

/** Rung `index` of the streak ladder, for a streak of `count` days, as it
 *  reads on the night that ends at `deadline`. */
export function streakAlertFor(
  index: number,
  count: number,
  deadline: Date,
): Line {
  const line = pickForDay(STREAK_ALERTS[index]!.lines, deadline, index * 7);
  return {
    title: fill(line.title, { n: count }),
    body: fill(line.body, { n: count }),
  };
}
