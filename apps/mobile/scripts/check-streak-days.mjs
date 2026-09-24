/**
 * The per-day streak log behind the week row on the streak widget.
 *
 *   node scripts/check-streak-days.mjs
 */
import assert from "node:assert/strict";

import { mergeDays, runDates, weekPattern } from "../app/lib/streak-days.ts";

// 2026-09-24 is a Thursday.
const THU = "2026-09-24";

assert.deepEqual(runDates({ currentStreak: 3, lastCompletedDate: THU }), [
  "2026-09-24", "2026-09-23", "2026-09-22",
]);
assert.deepEqual(runDates({ currentStreak: 0, lastCompletedDate: THU }), []);
assert.deepEqual(runDates({ currentStreak: 5, lastCompletedDate: null }), []);
// Crosses a month boundary in local time.
assert.deepEqual(runDates({ currentStreak: 2, lastCompletedDate: "2026-10-01" }), [
  "2026-10-01", "2026-09-30",
]);

// Done Mon–Wed, today (Thu) pending, rest ahead.
assert.equal(weekPattern(runDates({ currentStreak: 3, lastCompletedDate: "2026-09-23" }), THU), "DDDTFFF");
// Done today too.
assert.equal(weekPattern(runDates({ currentStreak: 4, lastCompletedDate: THU }), THU), "DDDDFFF");
// A break on Tue: Mon kept from the log, Tue missed, Wed–Thu the new run.
const log = mergeDays(["2026-09-21"], { currentStreak: 2, lastCompletedDate: THU }, THU);
assert.deepEqual(log, ["2026-09-21", "2026-09-23", "2026-09-24"]);
assert.equal(weekPattern(log, THU), "DMDDFFF");
// Sunday is the last column, and a long streak fills the whole week.
assert.equal(weekPattern(runDates({ currentStreak: 30, lastCompletedDate: "2026-09-27" }), "2026-09-27"), "DDDDDDD");
// Monday starts a fresh row.
assert.equal(weekPattern(runDates({ currentStreak: 30, lastCompletedDate: "2026-09-27" }), "2026-09-28"), "TFFFFFF");
// The log forgets what the widget can no longer show.
assert.deepEqual(mergeDays(["2026-08-01", "2026-09-20"], { currentStreak: 0, lastCompletedDate: null }, THU), ["2026-09-20"]);

console.log("streak-days: ALL CHECKS PASSED");
