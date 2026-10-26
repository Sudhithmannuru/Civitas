// Document-reader date mapping. No network. The model reply is synthetic.
// Ages use a local noon so the expected year does not depend on the machine's zone.

import { parseExtraction } from "../lib/onboarding/i94Extract.ts";

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function extract(fields, now) {
  return parseExtraction(JSON.stringify({
    documents_detected: ["i94"],
    fields,
  }), now);
}

// Local noon on Oct 26. A birth date of Oct 27 has not happened yet.
const oct26 = new Date(2026, 9, 26, 12, 0, 0);

const birthdayTomorrow = extract({
  date_of_birth: { value: "1990-10-27", confidence: "high" },
}, oct26);
check("day-before birthday age", birthdayTomorrow.fields.age?.value, 35);
check("dob kept", birthdayTomorrow.fields.date_of_birth?.value, "1990-10-27");

// Jan 1 1900 is a real calendar day. Parsing it as UTC midnight used to look
// like Dec 31 1899 in US time zones and get rejected.
const oldest = extract({
  date_of_birth: { value: "1900-01-01", confidence: "high" },
}, oct26);
check("1900-01-01 kept", oldest.fields.date_of_birth?.value, "1900-01-01");

const dropped = extract({
  date_of_birth: { value: "1899-12-31", confidence: "high" },
  arrival_date: { value: "2099-01-01", confidence: "high" },
  eligibility_date: { value: "2026-02-31", confidence: "high" },
}, oct26);
check("pre-1900 dropped", dropped.fields.date_of_birth, undefined);
check("future arrival dropped", dropped.fields.arrival_date, undefined);
check("Feb 31 dropped", dropped.fields.eligibility_date, undefined);

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
