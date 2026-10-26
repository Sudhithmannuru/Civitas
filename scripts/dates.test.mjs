// Calendar-date helper checks. No DB, no LLM.
// A date-only string must stay on that calendar day in every time zone.

import { addCalendarMonths, calendarDaysUntil, parseISODate } from "../lib/dates.ts";

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

check("reject Feb 31", parseISODate("2026-02-31"), null);
check("keep May 1", parseISODate("2026-05-01")?.day, 1);

check("May 1 plus 4 months", addCalendarMonths("2026-05-01", 4), "2026-09-01");
check("May 1 plus 3 months", addCalendarMonths("2026-05-01", 3), "2026-08-01");
check("Jan 31 plus 1 month, non-leap", addCalendarMonths("2026-01-31", 1), "2026-02-28");
check("Jan 31 plus 1 month, leap", addCalendarMonths("2024-01-31", 1), "2024-02-29");
check("invalid base", addCalendarMonths("2026-02-31", 1), null);

// 2026-10-01T02:00:00Z is still the evening of Sep 30 in New York.
const eveningBefore = new Date("2026-10-01T02:00:00.000Z");
check(
  "Oct 1 deadline is tomorrow in New York",
  calendarDaysUntil("2026-10-01", eveningBefore, "America/New_York"),
  1,
);
check(
  "Oct 1 deadline is today in UTC",
  calendarDaysUntil("2026-10-01", eveningBefore, "UTC"),
  0,
);
check(
  "passed deadline stays negative",
  calendarDaysUntil("2026-09-01", eveningBefore, "America/New_York"),
  -29,
);

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
