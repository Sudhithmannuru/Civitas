// Deterministic autofill safety checks. No model calls.
// A redacted secret must never be typed into a portal field.

import { validatePlan } from "../lib/autofill/plan.ts";

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

const snapshot = {
  url: "https://benefits.example.gov/apply",
  title: "Apply",
  headings: ["Household"],
  fields: [
    { ref: "phone", label: "Phone number", type: "tel", name: "phone", required: true },
    { ref: "notes", label: "Notes", type: "text", name: "notes" },
    { ref: "ssn", label: "Social Security Number", type: "text", name: "ssn", required: true },
  ],
  buttons: [
    { ref: "next", text: "Continue", kind: "button" },
    { ref: "submit", text: "Submit application", kind: "submit" },
  ],
  errors: [],
};

const plan = validatePlan(JSON.stringify({
  pageType: "application_step",
  summary: "Household step",
  actions: [
    { action: "fill", ref: "phone", value: "5125551212", label: "Phone number", reason: "from profile" },
    { action: "fill", ref: "notes", value: "123-45-6789", label: "Notes", reason: "copied" },
    { action: "fill", ref: "ssn", value: "123-45-6789", label: "SSN", reason: "from profile" },
    { action: "click", ref: "submit", label: "Submit application", reason: "done" },
  ],
}), snapshot);

const phone = plan.actions.find((a) => a.action === "fill" && a.ref === "phone");
const notes = plan.actions.find((a) => "ref" in a && a.ref === "notes");
const ssn = plan.actions.find((a) => "ref" in a && a.ref === "ssn");
const typed = plan.actions.filter((a) => a.action === "fill" || a.action === "select").map((a) => a.value);

check("phone typed as entered", phone?.value, "5125551212");
check("ssn-shaped notes handed off", notes?.action, "handoff_sensitive");
check("ssn field handed off", ssn?.action, "handoff_sensitive");
check("no redacted placeholder typed", typed.includes("[REDACTED]"), false);
check("submit click becomes review", plan.actions.some((a) => a.action === "review"), true);
check("submit was not clicked", plan.actions.some((a) => a.action === "click"), false);

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
