# FixFlow

An Integrated Digital Service Request, Quotation, and Booking Platform for Local Repair Businesses.

Ionic Vue 3 (`<script setup>`) + Capacitor 8 Android app. The Android APK is built by GitHub Actions, so Android Studio is not needed.

## What it does

Two roles share one request workflow.

| Step | Status | Who acts |
| --- | --- | --- |
| 1 | Requested | Customer submits a request with photos |
| 2 | Under review | Owner starts review |
| 3 | Quotation sent | Owner sends an itemized quotation |
| 4 | Quotation accepted | Customer accepts (or declines) |
| 5 | Scheduled | Customer picks a slot from the shop's real availability |
| 6 | In progress | Owner starts the job |
| 7 | Completed | Owner finishes the job |
| 8 | Feedback given | Customer rates the service |

Off-ramps: `declined` (the customer declines the quotation) and `cancelled` (either side, any time before the job starts, with a reason). Every change creates an in-app notification for the other party.

The owner controls when customers can book. **Shop schedule** (Dashboard or Profile, owner only) sets:

- weekly opening hours, per day, in 30 minute steps (each day can open, close or run different hours)
- an optional lunch break
- slot length (30, 60, 90 or 120 minutes) and how many jobs can run at the same time
- minimum notice (none up to 2 days) and how far ahead customers can book (7 to 90 days)
- days off for holidays or time away, with an optional reason

Customers only see times that fit this schedule, and the shop hours show on their Profile. Changes apply as soon as the owner saves. Visits that are already booked are never moved or cancelled; if a change leaves some outside the new hours, the screen lists them so the owner can reschedule or contact the customer.

Also included: request history per account, search and status filters, photo upload with on-device compression, a status stepper on every request, and an owner dashboard.

## Run it (Windows, macOS or Linux)

Requires Node 22.12 or newer (the CI uses Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run typecheck    # vue-tsc, strict
npm test             # vitest, 193 tests
npm run lint:policy  # design, TypeScript, accessibility and error-handling rules
npm run build        # typecheck + production build into dist/
npx cap sync android # copy dist/ into the Android project
```

### Demo accounts

All use the password `fixflow123`. They are shown on the sign-in screen.

| Email | Role |
| --- | --- |
| `ana@fixflow.app` | Customer (has sample requests at several stages) |
| `ben@fixflow.app` | Customer (second customer, to see that accounts are separate) |
| `owner@fixflow.app` | Business owner |

New customers can register in the app. There is one owner account, because this is a single-shop platform.

## Get the Android APK

1. Create a GitHub repository and push this folder (`android/` is committed on purpose).
2. Open the repository's **Actions** tab. The workflow **Build FixFlow Android APK** runs on every push to `main`, or manually via **Run workflow**.
3. When it finishes, download the artifact **FixFlow-APK** and unzip it to get `FixFlow.apk`.
4. Copy it to an Android phone and install it (allow "install unknown apps" when asked).

The workflow: checkout, Node 24, `npm ci`, `npm test`, `npm run build`, Java 21 (Temurin), environment checks, `npx cap sync android`, `./gradlew assembleDebug`, upload.

## Architecture

```
src/
  domain/       Pure TypeScript, no Vue, no storage. Easy to test.
                workflow.ts   transition table + applyAction()
                quotation.ts  totals in integer centavos
                availability.ts  the owner's schedule: zod schema, defaults, readable hours
                schedule.ts   slot generation, capacity and booking validation from an Availability
                types.ts      zod schemas for stored and submitted data, the place unknown data is parsed
                errors.ts     typed AppError hierarchy and safe user messages
  data/         IndexedDB repository, PBKDF2 passwords, session, seed data
  composables/  Shared state (session, requests, notifications), async-action helper
  components/   Reusable UI (no nested cards, tokens only)
  views/        Routed pages; every one has an <ion-page> root
  theme/        global.css (design tokens) and variables.css (Ionic mapping)
tests/          Workflow, quotation, schedule, schema and repository tests
scripts/        policy-check.mjs
```

Key decisions:

- **Local-first, no backend.** Data lives in IndexedDB on the device, so the app works offline and needs no server to demo. The `repo.ts` functions are the seam where a real API would replace IndexedDB.
- **Workflow is data.** Allowed actions per status and role are one table in `workflow.ts`; the UI and the tests both read it, so they cannot drift apart.
- **Atomic changes.** A status change, the slot booking and its notifications commit in one IndexedDB transaction. A full slot or a stale request rolls everything back and the user sees a clear message.
- **Money is integer centavos**, formatted only at the edge.
- **Scheduling is data, not code.** The owner's `Availability` (stored in IndexedDB) is the single source of truth. `schedule.ts` generates slots from it and checks every booking against it again inside the booking transaction, so a customer cannot book time the owner has just closed. A new shop starts with Monday to Saturday, 9 AM to 5 PM, one-hour slots, two jobs at a time, 1 hour notice and 14 days ahead; the demo data adds a 12 to 1 PM lunch break.
- **Capacity survives schedule changes.** Each appointment records its own length. A slot is full when the most visits running at the same moment inside it reaches the capacity, so a one-hour visit booked earlier still blocks both halves of its hour after the owner switches to 30 minute slots.
- **Passwords** are hashed with PBKDF2-SHA256 (210,000 iterations, per-user salt) via WebCrypto.

## Policies and how they are enforced

`npm run lint:policy` checks, from the real source and tokens:

- no em dashes or emoji in the UI, icons come from Lucide
- no `any`, no `@ts-ignore`, no unchecked `as` (only `as const`), no empty `catch`, no `console.*` outside the logger
- every `<img>` has `alt`, no `v-html`, no removed outlines
- no raw colors, radii, shadows, font sizes, spacing or timings outside the `:root` tokens
- WCAG contrast for 22 text and control color pairs, and borders at least 10 lightness points darker than the surface they sit on
- Ionic RGB triplets match the tokens they mirror

TypeScript runs with `strict`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Async screens use a discriminated union (`loading`, `success`, `error`) with a retry action, and every routed page sits inside an error boundary.

Checked in a headless browser at 390 px width: the full request to feedback flow for both roles, and axe-core reports 0 WCAG 2.1 AA violations on every main screen.

## Icons and splash

Sources are in `assets/` (SVG and PNG). To regenerate the Android resources:

```bash
npx capacitor-assets generate --android --iconBackgroundColor '#1357ae' --splashBackgroundColor '#faf9f7'
npx cap sync android
```

## Known limits

- **One shared schedule.** Availability is one calendar for the whole shop (with a number of simultaneous jobs), not a calendar per technician. Times use the device's time zone.
- **Data is per device.** Two phones do not see each other's requests. A real deployment needs a backend behind `src/data/repo.ts`.
- **Debug APK.** It is signed with the debug key, fine for testing and sideloading, not for Play Store upload. A release build needs your own keystore.
- **Push notifications** are in-app only (the Alerts tab and badge). System push needs a server.
- **Bundle size.** The Ionic core chunk is about 1.1 MB (235 KB gzipped). It loads from the device, not the network, so it does not affect the APK's startup over a connection.
- **`npm audit`** reports 3 moderate findings in `@capacitor/cli` (xcode, uuid). They are dev-only tooling and are not shipped in the app.
- **Workflow action versions** (`checkout@v5`, `setup-node@v5`, `setup-java@v5`, `upload-artifact@v4`) could not be verified from the build environment. If a run fails at "Set up job", check the current major versions on the GitHub Marketplace.
#   f i x f l o w  
 