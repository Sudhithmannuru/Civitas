// Calendar-date helpers.
//
// Date-only values in this app ("2026-10-01") are calendar days, not instants.
// `new Date("2026-10-01")` is UTC midnight, which is still the previous evening
// in US time zones, so month arithmetic and "days left" countdowns were off by
// one. These helpers keep the year/month/day from the string itself.

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export function parseISODate(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function calendarDateOf(instant: Date, timeZone?: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function calendarDaysBetween(from: CalendarDate, to: CalendarDate): number {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / 86_400_000);
}

/** Whole years from a date of birth to `now`'s calendar day. Null if the date is invalid or the age is outside 0–120. */
export function ageInYears(
  dobISO: string,
  now: Date = new Date(),
  timeZone?: string,
): number | null {
  const dob = parseISODate(dobISO);
  if (!dob) return null;
  const today = calendarDateOf(now, timeZone);
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) age--;
  return age >= 0 && age <= 120 ? age : null;
}

/** True when `iso` is a real calendar day on or before `now` in the chosen zone. */
export function isISODateOnOrBefore(
  iso: string,
  now: Date = new Date(),
  timeZone?: string,
): boolean {
  const parsed = parseISODate(iso);
  if (!parsed) return false;
  return calendarDaysBetween(parsed, calendarDateOf(now, timeZone)) >= 0;
}

/** Days from `now`'s calendar date until `iso`. Today is 0. Past dates are negative. */
export function calendarDaysUntil(
  iso: string,
  now: Date = new Date(),
  timeZone?: string,
): number | null {
  const target = parseISODate(iso);
  if (!target) return null;
  return calendarDaysBetween(calendarDateOf(now, timeZone), target);
}

// Adds calendar months and clamps overflow (Jan 31 + 1 month -> last day of February).
export function addCalendarMonths(iso: string, months: number): string | null {
  const parsed = parseISODate(iso);
  if (!parsed) return null;
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const day = utc.getUTCDate();
  utc.setUTCMonth(utc.getUTCMonth() + months);
  if (utc.getUTCDate() !== day) utc.setUTCDate(0);
  return utc.toISOString().slice(0, 10);
}
