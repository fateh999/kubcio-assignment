# Clinic Management Prototype

A working prototype for a small clinic:
- **the visit handoff** (reception → nurse → doctor → reception), with who's waiting and who's handling them
- **test results** waiting for the doctor's review
- **patients who may suit a diabetes study**, without treating a match as eligibility or consent

Synthetic data only. It runs entirely on your machine, with no accounts or API keys. Internet is needed only for the first install.

[PRD](./Clinic%20Management%20Prototype%20—%20PRD.md) · [Build spec](./SPEC.md) · [Testing](./docs/testing.md) · [Build log](./docs/build-log.md)

## Run it

Needs Docker Desktop (running) and Bun 1.1+.

```bash
docker compose up -d --wait         # Postgres + Mailpit (email inbox)
bun install
cp .env.example .env.local          # works as-is
bun run db:push && bun run seed     # tables, ~30 patients, today's visits, 6 staff
bun dev                             # http://localhost:3000
```

Sign in with a staff email below, then click the link in **Mailpit at http://localhost:8025**. There are no passwords.

| Email | Who | Role |
| --- | --- | --- |
| `reception@clinic.test` | Rosa Mendes | Receptionist |
| `priya@clinic.test` · `tom@clinic.test` | Priya Shah · Tom Okafor | Nurse |
| `khan@clinic.test` · `nowak@clinic.test` | Dr Aisha Khan · Dr Marek Nowak | Doctor |
| `admin@clinic.test` | Clinic Owner | Admin |

To be two people at once, use a second browser or a private window. `bun run seed` resets the data; `docker compose down -v` wipes everything.

> **Port 3000 taken?** `bun dev` moves to another port, but sign-in links still point at 3000. Free the port, or set `BETTER_AUTH_URL` in `.env.local` to the new port and restart.

## Review it in 5 minutes

**1. Watch every PRD success criterion pass, recorded:**

```bash
bunx playwright install chromium    # once
bun run test:e2e:report             # ~2 min, then opens the report
```

Each test in the report has its steps, a **video for each person signed in** and a **trace** you can scrub through. Prefer it live? `bun run test:e2e:watch` runs it in a visible, slowed-down browser. The e2e tests use their own server (port 3100) and **reset the local database**.

**2. Or click through it yourself.** Each PRD success criterion, where to see it, and the test that checks it:

| PRD success criterion | Try this | Test |
| --- | --- | --- |
| Only added staff can sign in; each role lands on its view; non-admins can't open admin | Sign in as each role; try `stranger@example.com`; as a nurse, open `/admin` | `auth.spec` |
| Access rules hold; reception can't read clinical data; a deactivated user is blocked | As reception, open a doctor page or `/results` (refused); as admin, deactivate someone | `auth.spec`, `access.spec`, `test:db` |
| Everyone sees today's visits, stage, who's handling, minutes waiting | Board: urgent Samuel sorts above Zofia, who arrived first | `visit-flow.spec` |
| A patient moves through every stage; each handoff shows the next person what they need | Reception checks in **Hannah** → Priya takes her ("With nurse · Priya") and sends vitals → Dr Khan takes her | `visit-flow.spec` |
| The doctor sees the reason and nurse notes first | The doctor's page opens with the reason, vitals and nurse note | `visit-flow.spec` |
| Reception sees open checkout tasks and can't complete with any open | Dr Khan adds a task → reception's **Complete visit** stays disabled until it's ticked (the server also refuses a stale page) | `visit-flow.spec`, `test:db` |
| Unreviewed results in one list; they leave when reviewed | As a doctor: **Results (8)** → Mark reviewed → 7 | `results.spec` |
| The matcher gives possible match / needs check / no match with evidence, with no eligibility wording | Doctor → *Diabetes study*: 4 + 4 candidates with evidence; Sunita: "Missing: Date of birth" | `bun test`, `study.spec` |
| Missing information gives *needs check*, never *possible match* | Same list: Sunita (no date of birth), Gareth (metformin, no diagnosis) | `bun test` |
| Consent stays *unknown* until reception records it after reaching the patient | Approve Margaret → *Needs call*, consent Unknown → reception: Reached → still Unknown → Consented | `study.spec`, `test:db` |

Also added on request: reception can **Add walk-in** (a patient without an appointment, checked in at once).

## Decisions worth knowing

- **Where the PRD contradicts itself:**
  - **Checkout tasks:** only the **doctor adds** checkout tasks; reception ticks them off. The PRD's access table says so, though its assumptions list says otherwise.
  - **Study evidence:** reception sees **no study evidence** (it lists diagnoses, which reception may not read). Reception gets name, phone, call status and consent only.
- **Assumptions to confirm with the clinic:**
  - the doctor reviews study matches
  - urgent first, then arrival time; reception marks urgent
  - any doctor can take a patient; the preferred doctor is shown only
  - no lab thresholds or recency rules for the study
  - simple per-role access, managed by the admin
- **Safety:**
  - every page and every server action checks the role on the server
  - every stage change is a single conditional update, so double clicks and two staff taking the same patient are safe
  - nothing can be deleted

Full reasoning: [SPEC §15–16](./SPEC.md).

## Known limits

- **Database:** access rules are enforced in the app, not by Postgres. Production would add row-level security.
- **Updates:** the board polls every 10 s (paused in hidden tabs), so other staff's changes can take up to 10 s to show.
- **Walk-ins:** each one creates a new patient record; there's no search for existing patients.
- **Sign-in:** links last 5 minutes and work once. In production builds, sign-in is rate-limited (5 per minute per network), and the page says so.
- **Out of scope** (as in the PRD): booking appointments, passwords/2FA, prescriptions, billing, notifications, editing diagnoses, more than one study, deployment.

## Build summary

- **Time:** the PRD's in-scope build took **~1 h 28 min**, inside the 2-hour budget. Requested extras (polling, a UI pass, walk-ins, the e2e suite) and a fresh-clone review brought the session to ~3 h.
- **Cut:** nothing from the PRD's scope.
- **Verified from a fresh clone with an empty database:** `bun test` 16/16 · `bun run test:db` 58/58 · `bun run test:e2e` 17/17 · lint, typecheck and build pass.
- **Bugs caught while verifying:** a checkout race (untick vs. complete), raw JSON shown to deactivated users, and the results page failing on a date parameter.

Each slice, its PR and how it was checked: [docs/build-log.md](./docs/build-log.md). Stack: Next.js 16, Tailwind + shadcn/ui, Postgres + Drizzle, Better Auth (magic link), Mailpit, Bun. Details in the [spec](./SPEC.md).
