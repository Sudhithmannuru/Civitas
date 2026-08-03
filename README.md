# Wayfinder

**A multilingual web app that tells refugees and immigrants which U.S. federal benefits they likely qualify for — with deadlines, required documents, and concrete next steps — and then helps them actually apply.**

> 🏆 **2nd place out of 321 teams** at the **USAII Global AI Hackathon**.
>
> **Jotin Samayamantri** was the primary technical contributor on the programming side.

---

## What it does

Arriving in the U.S. as a refugee or asylee means facing a maze of federal and state benefit programs — each with its own eligibility rules, filing windows, and paperwork, almost all of it in dense English legalese. Missing a deadline (many programs have a hard 4–8 month window from arrival) can mean permanently losing a benefit.

Wayfinder turns that maze into a clear, personalized action plan:

- **Onboarding wizard** — a short, plain-language intake (immigration status, arrival dates, household, income, goals) collected across ~30 supported languages. Sensitive identifiers like SSNs and A-Numbers are *never* collected.
- **Eligibility engine** — determines, per program, whether the person is `likely_eligible`, `maybe_eligible`, `not_eligible`, or `needs_human_review`, across 25 federal programs.
- **Personalized action plan** — ranked by soonest deadline first, with a plain-language "why you qualify," required documents, days left to apply, and links to the official source.
- **Fill out with AI** — an in-browser agent (via a companion Chrome extension) that opens the real government application portal, fills in the non-sensitive fields from the user's saved profile, pauses for anything sensitive (SSN, captchas, sign-ins, legal consent), and **always stops before submitting** so the user reviews and submits themselves.
- **Document assistant** — upload an I-94, work permit, or other document and Wayfinder extracts the fields to pre-fill forms.
- **Explain-a-letter** — paste or upload a confusing government letter and get a plain-language explanation.
- **Find Help** — state-keyed directory of resettlement agencies and legal aid.

Everything — UI, summaries, and next steps — is delivered in the user's chosen language.

---

## Architecture

Stack: **Next.js 16 (App Router) + React 19**, **Supabase** (auth + Postgres + Storage), **Claude** (`@anthropic-ai/sdk`), **Tailwind CSS 4**, deployed on **Vercel**.

### User flow

```
signup/login (app/auth/*)
  → onboarding wizard (app/onboarding)        writes the `profiles` row
  → processing (app/processing)               triggers POST /api/eligibility
  → dashboard (app/dashboard)                 tabs: action plan · documents ·
                                              form assistant · explain-a-letter ·
                                              find help · progress
```

### Eligibility engine — `app/api/eligibility/route.ts`

The heart of the app, and deliberately layered:

1. **Deterministic derived fields** (`computeDerived`) are computed in TypeScript: ORR-eligible / qualified-alien / LPR status, months and years since key dates, `percent_fpl` from the HHS poverty table, and pre-gated flags (`eligible_for_tanf/ssi/medicaid`) that downstream rules depend on.
2. **Rule application** is delegated to Claude, which receives the profile + derived fields + the full structured rule database and returns per-benefit statuses.
3. A **verification pass** re-checks the result; any disagreement on a non-`not_eligible` benefit is downgraded to `needs_human_review`.
4. A short final call writes a warm summary **in the user's language**. Results are ranked (soonest deadline first) and persisted to `eligibility_results`.

### Data & rules — `data/` and `database/`

- `database/benefits.json` — 25 federal programs, each with a machine-evaluable `rule` tree (`{all, any, not, var, is, lte, gte, fpl}`), deadlines, required docs, restoration paths, and dated sources. Encodes time-sensitive 2025–2026 policy (OBBBA SNAP/Medicaid/ACA cliffs, the RCA/RMA 4-month window).
- `data/fpl_2025.json` — HHS Federal Poverty Level table (drives `fpl` rule checks; update annually).
- `data/providers_directory.json` — state-keyed resettlement / legal-aid resources.

### Internationalization — `locales/`, `lib/translations.ts`

`locales/en.json` is the master string set. For any other language, `getTranslations(code)` reads the Supabase `ui_translations` cache, and on a miss asks Claude to translate the whole string set (preserving keys and `{placeholders}`), then caches it globally for every future user. Add UI strings to `en.json`; other languages are generated on demand.

### The "Fill out with AI" agent — `extension/` + `app/api/autofill`

A companion Chrome extension bridges Wayfinder's in-page side panel to the government portal tab it can't touch directly:

- The app snapshots each portal page, asks the planner (`/api/autofill/plan`) for the next safe actions, executes the safe fills, and narrates progress live.
- It **pauses for the user** on anything only a human should do: missing info, sensitive fields (SSN, A-Number, bank/card numbers), captchas, sign-in walls, and legal-consent checkboxes (which route to a "talk to your attorney first" hand-off).
- It **never submits** — it stops at the review step behind a confirmation gate.

### Server / client boundaries

- `lib/claude.ts` and the service-role Supabase client are **server-only** — never imported from client components, and the API/service keys are never exposed to the browser.
- Supabase: `lib/supabase/server.ts` (`createClient()` respects user cookies; `createServiceClient()` for privileged writes) and `lib/supabase/client.ts` (browser).
- Middleware lives in `proxy.ts` at the repo root (Next.js 16 convention) — it runs `supabase.auth.getUser()` on every request and protects the authenticated routes.

### Types & database

- `lib/types.ts` is the single source of truth for `Profile`, `ImmigrationStatus`, `EligibilityBenefit`, `EligibilityResult`, `Document`, `BenefitProgress`, and related enums.
- `supabase/schema.sql` + `supabase/migration_v2.sql` define `profiles`, `eligibility_results`, `documents` (+ a private `user-documents` storage bucket), `benefit_progress`, and `ui_translations`. Row-Level Security isolates every user to their own rows.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (run `supabase/schema.sql` and `supabase/migration_v2.sql`)
- An Anthropic API key

### Environment

Create `.env.local`:

```bash
ANTHROPIC_API_KEY=...                  # Claude API
NEXT_PUBLIC_SUPABASE_URL=...           # Supabase client / auth
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server-only privileged writes
EXTENSION_JWT_SECRET=...               # signs extension pairing tokens (Fill out with AI)
```

### Run

```bash
npm install
npm run dev        # start the dev server at http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (flat config, eslint-config-next)
```

> There is no test runner configured. Verify changes with `npm run build` + `npm run lint` and by exercising the flows in the running app.

### The "Fill out with AI" browser extension

The companion extension is in `extension/`. It is **not** yet published to the Chrome Web Store, so it is loaded unpacked:

1. Download `public/wayfinder-extension.zip` (also offered as a download inside the app during onboarding and in **Settings → Auto-fill**) and unzip it.
2. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the unzipped `wayfinder-extension` folder.
3. In Wayfinder, open **Settings → Auto-fill → Set up auto-fill** to get a pairing code, then enter it in the extension popup.
4. Open your Action Plan and click **Fill out with AI** on any program.

To rebuild the extension after editing `extension/src/*`:

```bash
cd extension
npm install
npm run build      # bundles into extension/dist via esbuild
```

The extension trusts only specific app origins (localhost, `wayfinder.app`, and the whitelisted Vercel host in `extension/src/popup.ts` + `extension/manifest.json`). Add any new deployment domain to both places, rebuild, and re-zip.

---

## Project layout

```
app/            Next.js App Router — pages + API routes
  api/          eligibility, autofill/plan, form-assist, documents, onboarding,
                extension pairing, translate
  dashboard/    the main authenticated experience (tabbed)
  onboarding/   multilingual intake wizard
components/     shared React components (AutofillAgent, AutofillSetup, i18n, …)
lib/            server + client helpers (claude, supabase, eligibility, types, i18n)
data/           FPL table, providers directory
database/       25-program benefits rule database + schema docs
locales/        en.json master string set (other languages generated on demand)
extension/      companion Chrome extension (src → dist via esbuild)
supabase/       SQL schema + migrations
proxy.ts        Next.js 16 middleware (auth + route protection)
```

---

## Credits

Built for the **USAII Global AI Hackathon**, where it placed **2nd out of 321 teams**.

Made by **Jotin Samayamantri, Aarit Choudhary, and Arnav Sahoo**.
