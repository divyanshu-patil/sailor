/**
 * When the current billing period ends, written the way a person reads it.
 *
 * A bare date reads as a bug when the period is short: a sandbox or Test Store
 * "monthly" plan can expire the same day it was bought, and "Renews 21 Sep" on
 * 21 Sep looks broken rather than accelerated. Same-day and next-day endings
 * get the clock instead; anything further out gets the date, because nobody
 * needs the minute a renewal three weeks away will happen.
 *
 * Shared by the profile card and the cancel screen — they are two sentences
 * about the same moment and must not disagree about it.
 */
export const formatRenewal = (iso: string, includeYear = false): string => {
  const end = new Date(iso);
  const startOfDay = (date: Date) => new Date(date).setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfDay(end) - startOfDay(new Date())) / 86_400_000,
  );

  if (days === 0 || days === 1) {
    const time = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${days === 0 ? "today" : "tomorrow"} ${time}`;
  }

  return end.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
};
