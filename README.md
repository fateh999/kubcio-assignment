# Clinic Management Prototype

A working prototype for a small clinic. It covers three things:
- the visit handoff (reception → nurse → doctor → reception), showing who is waiting and where each patient is
- test results waiting for the doctor's review
- patients who may suit a diabetes study, without ever treating a match as eligibility or consent

All data is synthetic. Everything runs on your machine: no accounts or API keys. Internet is needed only for the first install (packages, Docker images and the font).

- [PRD](./Clinic%20Management%20Prototype%20—%20PRD.md): what the clinic asked for
- [Build spec](./SPEC.md): how it's built, including where the PRD contradicts itself (§16)

## Run it

**Requirements:** Docker Desktop running, Bun 1.1+.

1. `docker compose up -d --wait`: starts Postgres on 5432 and Mailpit on 1025 (SMTP) and 8025 (inbox), and waits until Postgres is ready
2. `bun install`
3. `cp .env.example .env.local`: ships ready to use (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, SMTP on localhost:1025)
4. `bun run db:push && bun run seed`: creates the clinic and auth tables, seeds ~30 patients and today's visits, creates the 6 staff accounts, and runs study matching
5. `bun dev`, open http://localhost:3000, enter one of the staff emails below, and click the link in **Mailpit at http://localhost:8025**

`docker compose down -v` wipes the database for a fresh start. `bun run seed` alone resets the data to the seeded state.

**If port 3000 is taken**, `bun dev` quietly starts on another port, but sign-in links still point at `http://localhost:3000` (`BETTER_AUTH_URL` in `.env.local`). Either free port 3000, or set `BETTER_AUTH_URL` to the port `bun dev` prints and restart it.

### Staff accounts

Sign-in is by magic link only; there are no passwords. Each role lands on its own view.

| Role | Name | Email | Lands on |
| --- | --- | --- | --- |
| Admin (clinic owner) | Clinic Owner | `admin@clinic.test` | Staff accounts |
| Receptionist | Rosa Mendes | `reception@clinic.test` | Visit board, reception queue |
| Nurse | Priya Shah | `priya@clinic.test` | Visit board, waiting for nurse |
| Nurse | Tom Okafor | `tom@clinic.test` | Visit board, waiting for nurse |
| Doctor | Dr Aisha Khan | `khan@clinic.test` | Visit board, waiting for doctor |
| Doctor | Dr Marek Nowak | `nowak@clinic.test` | Visit board, waiting for doctor |

To try two roles at once (e.g. reception and nurse), use a second browser or a private window. Sessions are per browser.

## Tests

| Command | What it runs | Needs |
| --- | --- | --- |
| `bun test` | Study matcher (all 6 PRD edge cases; missing data never gives *possible match*; no eligibility wording) and visit-stage rules | `bun install` |
| `bun run test:db` | Against Postgres: stage transitions with concurrent staff; every server action's rules (role, stage, "only the assigned nurse/doctor", review/call/consent independence); checks that each action is guarded by the roles in the spec | Docker up and `bun run db:push` (the tests create and remove their own data) |
| `bun run test:e2e` | **End-to-end in a real browser (Playwright):** every PRD success criterion, signing in through real magic links from Mailpit. See below | Docker up, `.env.local`, `bun run db:push`, and once: `bunx playwright install chromium` |

`bun run lint`, `bun run typecheck` and `bun run build` also pass.

### End-to-end tests (for reviewers)

```bash
docker compose up -d --wait
bun install
cp .env.example .env.local        # if you haven't already
bun run db:push
bunx playwright install chromium  # once
bun run test:e2e                  # ~2 min including the production build
```

It builds the app and serves it on its own port (**3100**), so it doesn't clash with a dev server on 3000. Each spec file **re-seeds the database** first, so run it on a database you don't mind resetting. A failure leaves a trace, screenshot and HTML report (`bunx playwright show-report`).

| File | PRD success criteria covered |
| --- | --- |
| `e2e/auth.spec.ts` | Signed-out redirect (real 307); an unknown email gets the same message and its link is refused; each role lands on its view; a used link is refused; nurse refused `/admin`, reception refused the doctor page and results; admin adds staff (invite email), changes role, deactivates (open session ends, new link refused) and reactivates; admin can't deactivate themselves |
| `e2e/visit-flow.spec.ts` | Board shows stage, who's handling, minutes waiting, urgent first; **one patient through every role** with the handoff shown first to the doctor; checkout blocked while a task is open, including from a **stale page** (server refuses); the board **updates on its own** when someone else acts; **walk-in** added by reception joins the nurse's queue in the right order |
| `e2e/results.spec.ts` | Unreviewed results oldest first; marking one removes it and the count drops; nurses can't mark |
| `e2e/study.spec.ts` | Possible match / needs check with evidence, no eligibility wording; approve → *Needs call*, **consent Unknown**; reached → still Unknown; reception records consent (with who); re-run keeps review/call/consent; dismissed patients never reach the call list |
| `e2e/access.spec.ts` | Reception's raw server responses (board, checkout, study) contain no diagnoses, medications, allergies, results or notes; the admin's board is read-only |

The test server runs with `AUTH_RATE_LIMIT=off`. The suite signs in dozens of times a minute, and Better Auth's production limit is 5 magic-link requests per minute per IP. Never set it for real use.

## Walkthrough

Seeded data is relative to today, so the board always has patients. To see every role, sign in as each person in turn (or in separate browsers).

**1. One patient through every role (Hannah Lindqvist, scheduled)**
1. **Reception** (`reception@clinic.test`): on the board, Samuel Adeyemi is marked **Urgent** and sorts above Zofia Mazur, who arrived first. Click **Check in** on Hannah.
2. **Nurse** (`priya@clinic.test`): "Waiting for nurse" lists Hannah. Click **Take patient**. Reception's board now shows *With nurse · Priya*. Enter vitals and a note. A typo such as BP 1220 is caught. Click **Send to doctor**.
3. **Doctor** (`khan@clinic.test`): Hannah's preferred doctor is Dr Nowak, but any doctor can take her. Click **Take patient**. The page shows the **reason for visit and the nurse's vitals and note first**, then diagnoses, medications, allergies and results. Add a checkout task (e.g. "Book follow-up in 3 months"), write a visit note, then click **Send to checkout**.
4. **Reception**: click **Checkout** on Hannah. You see phone, email and the open task, and **Complete visit is disabled** ("1 task still open"). Tick the task, then click **Complete visit**. Hannah moves to *Done · Seen by Dr Khan*.

**2. Results to review** (doctor): the nav shows **Results (8)**. Click **Mark reviewed** on the oldest. It leaves the list and the count drops. Nurses see the list but can't mark results.

**3. Diabetes study**
1. **Doctor** → *Diabetes study*: 4 *possible match* and 4 *needs check* patients, each with the evidence from the record and anything missing (e.g. Sunita Rao: no date of birth). **Approve for contact** Margaret Ellis: call status becomes *Needs call*, and **consent stays Unknown**.
2. **Reception** → *Diabetes study* → *Call list*: Margaret and her phone number. Reception never sees the evidence, because it contains diagnoses. Click **Reached**: consent is *still Unknown*.
3. **Reception** → *Consent* tab: click **Consented**. It records who did it.
4. **Doctor**: **Re-run matching** updates the match evidence but keeps Margaret's review, call and consent.

**4. Walk-in** (reception): **Add walk-in** on the board. Enter name, reason, sex and phone (date of birth and email are optional) and tick Urgent if needed. They're checked in straight away, sorted with the other urgent patients by arrival, and the nurse can take them like anyone else.

**5. Admin** (`admin@clinic.test`)
- Add a staff member: they get a magic link in Mailpit.
- Change a role, or deactivate someone: they're signed out at once and can't sign back in.
- You can't deactivate yourself or change your own role.
- A nurse who opens `/admin` is refused.

## What each role can do

Enforced in every page and every server action (SPEC §6, §8); the database tests check every action's guard.

| Data | Read | Write |
| --- | --- | --- |
| Staff accounts | All staff (names on the board) | Admin |
| Patients | All staff | Reception (contact details) |
| Diagnoses, medications, allergies | Nurse, doctor | Nobody (seeded) |
| Results | Nurse, doctor | Doctor (mark reviewed) |
| Visits | All staff | Reception, nurse, doctor: each only their own stage changes and fields |
| Checkout tasks | All staff | Doctor (add); reception, doctor (tick off) |
| Study candidates | Doctor, reception (no evidence) | Doctor (review, re-run matching); reception (call, consent) |

Nothing can be deleted.

## Assumptions (to confirm with the clinic)

Where the PRD left a decision open we made one so the prototype works. Each row is still worth asking the clinic. The two marked **Decided** are where the PRD contradicted itself; we settled them for the build.

| Assumption | Why | Ask the clinic |
| --- | --- | --- |
| The doctor reviews possible study matches | Owner said "staff"; a clinical judgment is safest with the doctor | Who should review matches? |
| Queue order: urgent first, then arrival time | Owner said arrivals and urgent cases change the order | Who can mark a patient urgent? (Reception, in this prototype) |
| Preferred doctor is shown, but any doctor can take the patient | Owner said patients *may* have a particular doctor | Should a patient wait for their preferred doctor? |
| No lab thresholds, recency rules or medication exclusions | None were confirmed for the study | The study's full criteria |
| Access is a simple per-role scheme, managed by an admin | Owner asked us not to treat permissions as confirmed | Who may see clinical details? |
| No staff or patient-volume assumptions | Owner gave no reliable counts | — |
| **Decided:** only the doctor adds checkout tasks; reception ticks them off | The PRD contradicts itself: its access table says doctor only, its assumptions say reception can add more. We follow the enforced access table (SPEC §16 #1) | What usually happens at checkout? Should reception add tasks? |
| **Decided:** reception's study tabs show no evidence, not even the match label | Evidence lists diagnoses, which reception may not read (SPEC §16 #2) | Is that the right split? |

## Known limits

- **Access rules are enforced in the app, not by the database.** Postgres is reachable only from the server, so app-level checks are enough for a local prototype. A production version would add Postgres row-level security as a second layer.
- **The board updates by polling, not push.** It refreshes every 10 seconds while the tab is open (paused when the tab is hidden), so other staff's changes can take up to 10 s to appear; **Refresh now** forces it. Websockets/SSE are out of scope.
- **Times use the server's local time zone.** "Today" means the server's calendar day.
- **Magic links expire after 5 minutes** (Better Auth's default) and work once.
- **Sign-in is rate-limited in production builds**: 5 magic-link requests or clicks per minute per IP (Better Auth's default; off in `bun dev`). Over the limit, the sign-in page says so.
- **A walk-in always creates a new patient record.** There's no search for an existing patient, so a known patient arriving without an appointment gets a duplicate record.
- Out of scope, as in the PRD: booking or editing appointments (walk-ins are the exception: added as already checked in), password reset, 2FA, prescriptions, billing, notifications, editing diagnoses/medications/allergies, more than one study, deployment.

## How it's built

Next.js 16 (App Router, TypeScript), Tailwind and shadcn/ui, PostgreSQL with Drizzle ORM, Better Auth (magic link and admin plugins), Mailpit and Postgres in Docker Compose, and Bun. Full details are in the [spec](./SPEC.md).

- `src/lib/matcher.ts`: the study matcher, a pure function, unit-tested
- `src/lib/transition-visit.ts`: every stage change is one conditional update, so double clicks and two staff taking the same patient are safe
- `src/server/*`: server-action logic (role re-check, input validation, conditional writes); `src/actions/*` are the thin guarded wrappers
- `src/server/queries.ts`: one read query per screen, selecting only what that role may see
- `src/proxy.ts`: signed-out requests get a real redirect to sign-in; `requireUser()` is the actual guard

**Where we differ from the PRD's stack wording:**
- **Auth CLI:** the PRD names `bunx @better-auth/cli generate`. From Better Auth 1.5 the CLI ships as the `auth` package (`bun run auth:generate`); its output is committed, so a fresh clone doesn't need it.
- **shadcn `form`:** the current shadcn style has no `form` component; its replacement, `field`, is used.

## Build log

Built with AI in one session on Nov 12, 2026. Each slice was checked before the next, and merged as a PR with its verification written up.

**Times are approximate.** They come from file and git timestamps (IST) and don't include planning before the PRD was saved. Corrections welcome.

| Slice | PRD slot | Approx. actual | PR | How it was verified |
| --- | --- | --- | --- | --- |
| Build spec from the PRD | 0:00–0:10 | 15:14–15:30 (~16 min) | (in the first commit) | No eligibility wording; consent kept separate; missing data → *needs check* |
| Scaffold, schema, seed, matcher + tests | 0:10–0:25 | 15:30–15:40 (~10 min) | #7, #8, #9 | `bun test` green on all edge cases; 3 seeded records spot-checked in the DB; re-run keeps review/call/consent |
| Sign-in, `requireUser`, admin page | 0:25–0:45 | 15:40–16:02 (~22 min) | #10 | Playwright: each role lands on its view; nurse refused `/admin`; deactivated user blocked; reception refused doctor page and `/results`; also checked on a production build |
| Visit stage machine | (part of 0:45–1:10) | 16:02–16:07 (~5 min) | #11 | DB tests incl. 10 rounds × 5 concurrent "take patient": exactly one wins |
| Server actions (visits, results, checkout, study) | (spread over 0:45–1:45) | 16:07–16:18 (~11 min) | #12 | 54 DB tests incl. untick-vs-complete race; mutation checks |
| All six screens | 0:45–1:52 | 16:18–16:34 (~16 min) | #13 | Playwright: one patient through every role; checkout blocked, including from a stale page; result leaves the list; approve → consent stays Unknown; reached → still Unknown; consent recorded |
| README | 1:45–1:52 | 16:34–16:42 (~8 min) | #14 | Every claim checked against code and seed; doc links resolve |
| *Extra, on request:* board polling | — | 16:42–16:47 (~5 min) | #15 | Live update without reload; paused while hidden; "Refresh now" |
| *Extra, on request:* cleaner, responsive UI | — | 16:47–17:05 (~18 min) | #15 | Screenshots; no sideways overflow at 390/768/1280 px for every role (42 checks) |
| *Extra, on request:* Playwright e2e suite | — | 17:05–17:19 (~14 min) | #16 | 16/16 on 4 runs; a consent mutation is caught |
| *Extra, on request:* walk-ins | — | 17:19–17:28 (~9 min) | #17 | DB tests + e2e; 17/17 twice |
| Fresh-clone run test + final review | 1:52–2:00 | 17:30–17:58 (~28 min) | #17 | See below |

**Fresh-clone run (Nov 12, 2026):**
- **Setup:** cloned from GitHub into an empty folder, wiped the database with `docker compose down -v`, then followed this README exactly. Steps 1–4 took ~7 s: containers healthy, 585 packages, tables created, seed 10/10 expected statuses (4 possible match, 4 needs check, 22 no match).
- **Step 5:** port 3000 was taken by another dev server. `bun dev` moved to 3001 as described, and the README's fix (set `BETTER_AUTH_URL`) worked. In the browser: `/` → sign-in → link clicked **in Mailpit's web inbox** → reception board (7 in My queue). A walk-in added through the dialog showed as Checked in, 0 min.
- **Tests:** `bun test` 16/16 · `bun run test:db` 58/58 · `lint`, `typecheck`, `build` pass · `bun run test:e2e` **17/17**.

**Time:** the PRD's in-scope build (spec through README) took **~1 h 28 min** (15:14–16:42), inside the 2-hour budget. Polling, the UI pass, the e2e suite and walk-ins were added afterwards on request, and the final review ran last; the whole session was ~2 h 45 min.

**What was cut:** nothing from the PRD's in-scope list.

**Added beyond the PRD, each noted in the spec:**
- `consentBy`, to record who recorded consent
- a friendly page for deactivated users' sign-in links
- `proxy.ts`, for real redirects in production
- row locks on checkout, which fixed an untick-vs-complete race found by a test
- approve/dismiss limited to listed candidates

**Bugs found and fixed while verifying:**
- deactivated users saw raw JSON when clicking a link
- emails with surrounding spaces were rejected
- the results page failed on a date parameter
- the checkout race above
