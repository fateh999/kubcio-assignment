# Clinic Management Prototype — PRD

Nov 12, 2026 · @Fateh Farooqui

## Overview

We are building a working prototype that makes the handoffs in a clinic visit clear (reception → nurse → doctor → reception), tracks test results waiting for the doctor's review, and surfaces patients who may suit a diabetes study, without ever treating a match as eligibility or consent.

- **Who:** a small clinic with physicians, nurses and one receptionist.
- **Data:** synthetic patients only.
- **Constraint:** 2 hours of planning and coding, built with AI and recorded.
- **Stack:** Next.js (App Router, TypeScript), Tailwind with shadcn/ui components (Table, Badge, Card, Dialog, Form, Select, Tabs), PostgreSQL with Drizzle ORM, Better Auth (magic-link and admin plugins), Postgres and Mailpit in Docker Compose with the app run locally (no deployment); Bun as package manager, script runner and test runner (bun test).

## Problem

The clinic owner named three problems; the prototype addresses each one directly.

1. **Handoffs aren't visible.** The doctor needs the reason for the visit and the nurse's notes. Reception needs to know what still has to happen before the patient leaves. Arrivals and urgent cases change the planned order, so staff need to see who is waiting and where each patient is in the visit.
2. **Results get lost.** The clinic struggles to keep track of results that still need the doctor's review.
3. **Study candidates are hard to find and follow up.** Staff need to see what in a record suggests a possible match, review it, then track calls and consent. A match alone is not consent.

## Users and needs

Each role gets a default view built around its part of the handoff; the owner left exact permissions to our judgment.

| Role | Needs to see | Needs to do |
| --- | --- | --- |
| Admin (clinic owner) | All staff accounts: name, email, role, active | Add doctors, nurses and receptionists (sends a magic-link invite); change roles; deactivate staff. Can also view the visit board |
| Receptionist | Who is waiting and at what stage; contact details; what's left before checkout; the study call list | Check patients in and out; complete checkout tasks; log study calls and consent |
| Nurse | Patients waiting for the nurse; reason for visit | Record blood pressure, weight, temperature and a note; send to the doctor |
| Doctor | Reason for visit and nurse notes first; diagnoses, medications, allergies and results as context; results to review; possible study matches | Add a visit note and checkout tasks; send to checkout; mark results reviewed; approve or dismiss study matches |

## Authentication and admin

Staff sign in with a magic link handled by Better Auth, an open-source library that runs inside the Next.js app. There is no external service, account or API key; the clinic owner (admin) adds and manages staff.

**Sign-in**

- Better Auth's tables (user, session, verification, account) are generated into the Drizzle schema with `bunx @better-auth/cli generate` and created by `db:push`.
- `magicLink` plugin with `disableSignUp: true`, so only staff the admin has added can sign in. nodemailer sends the link to Mailpit (SMTP localhost:1025, inbox localhost:8025). Nothing leaves the machine.
- `app/api/auth/[...all]/route.ts` mounts Better Auth with `toNextJsHandler`; the `nextCookies` plugin (listed last) lets server actions set the session cookie.
- `requireUser(roles)` calls `auth.api.getSession({ headers })`, and redirects if there is no session, the user is banned, or the role isn't allowed. It guards every page and every server action.
- Each role lands on its own default view after sign-in.

**Admin (clinic owner)**

- Uses Better Auth's `admin` plugin. Adding staff (name, email, role) calls `auth.api.createUser`; if the installed version requires a password, a random one is set and never used. The new staff member then signs in with a magic link.
- Changes a role with `setRole`, and deactivates staff with `banUser`, which also revokes their sessions. An admin can't ban themselves, so the clinic can't lock itself out.
- Roles are the plugin's `role` string: admin, receptionist, nurse, doctor. `requireUser` checks them.

**Who is doing what**

- Taking a patient records the signed-in nurse or doctor on the visit (`nurseId`, `doctorId`), so the board shows e.g. "With nurse · Priya".
- Vitals, result reviews, study reviews and consent updates record the signed-in user.

**Access rules (enforced in `requireUser` and server actions)**

| Data | Read | Write |
| --- | --- | --- |
| Staff accounts | All staff (names on the board) | Admin |
| Patients | All staff | Reception (contact details) |
| Conditions, medications, allergies | Nurse, doctor | Nobody (seeded; editing out of scope) |
| Results | Nurse, doctor | Doctor (mark reviewed) |
| Visits | All staff | Reception, nurse, doctor (each only their own stage changes and fields) |
| Checkout tasks | All staff | Doctor (add); reception, doctor (tick off) |
| Study candidates | Doctor (with match evidence); reception (call list and consent only: name, phone, call and consent status, no evidence, since it lists diagnoses) | Doctor (review, re-run matching); reception (call, consent) |

Nothing can be deleted. Postgres is reachable only from the server (there is no public API), so app-level checks are enough for a local prototype. The known limit: the database itself doesn't enforce these rules. A production version would add Postgres row-level security as a second layer.

**Out of scope:** passwords and password reset, OAuth, two-factor authentication, real email delivery, fine-grained permissions.

## Goals and success criteria

The prototype succeeds if each of these can be shown in a click-through and, where noted, an automated test.

- [ ] Only staff an admin has added can sign in; each role lands on its own view, and non-admins can't open the admin page.
- [ ] The access rules hold on every page and server action: reception can't read diagnoses, medications, allergies or results, and a deactivated (banned) user can't sign in or load any page.
- [ ] Any role can see today's visits, each patient's current stage, who is handling them, and how long they've waited.
- [ ] A patient moves through every stage, and each handoff shows the next person what they need.
- [ ] The doctor's view shows the reason for visit and the nurse's notes above everything else.
- [ ] Reception sees each patient's outstanding checkout tasks and can't complete checkout while any remain open.
- [ ] Unreviewed results appear in one list and leave it when the doctor marks them reviewed.
- [ ] The matcher returns *possible match*, *needs check* or *no match*, each with evidence, and never says "eligible" (tested).
- [ ] Missing information gives *needs check*, never *possible match* (tested).
- [ ] Consent stays *unknown* until reception records it after reaching the patient; approval and call status never set consent.

## Scope

We build the visit handoff first, because the owner asked us to focus on it; study tracking comes last, because it depends on the patient data.

**In scope, in build order**

1. Data model, synthetic seed data and the study matcher with unit tests
2. Magic-link sign-in, role guard and the admin page for staff
3. Visit board (queue) and the nurse step
4. Doctor step and the results-to-review list
5. Study candidates: doctor review, call tracking and consent
6. Checkout at reception and a README

**Out of scope (non-goals)**

- Booking or editing appointments: they are seeded
- Password reset, two-factor authentication and fine-grained permissions: sign-in is a Better Auth magic link, with simple per-role access
- Prescriptions, billing, messaging and notifications
- Editing diagnoses, medications or allergies
- More than one study, or a screen for writing study criteria
- Deployment: it runs locally

## Functional requirements

Every visit moves through six stages, and each screen below matches one handoff between them.

**Visit stages:** checked in → with nurse → ready for doctor → with doctor → ready for checkout → done. Seeded appointments not yet arrived show as *scheduled*.

**FR1 · Visit board (all roles)**

- Shows today's visits grouped or filtered by stage: patient name, reason, preferred doctor, appointment time, arrival time, minutes waiting and an urgent tag.
- Sort order: urgent first, then arrival time. Appointment time is shown for reference only.
- Reception can check in a scheduled patient and mark them urgent. Each role's default filter shows its own queue.

**FR2 · Nurse step**

- The nurse picks a checked-in patient (recorded as the visit's nurse), which moves them to *with nurse*.
- Records blood pressure (systolic/diastolic), weight (kg), temperature (°C) and a free-text note.
- "Send to doctor" moves the patient to *ready for doctor*.

**FR3 · Doctor step**

- The doctor picks a ready-for-doctor patient, which moves them to with doctor and records the doctor on the visit. Top of the page: reason for visit, nurse vitals and note.
- Below: diagnoses, active medications, allergies and recent results, with unreviewed results highlighted.
- The doctor writes a visit note and adds checkout tasks (e.g. "Book follow-up in 3 months").
- "Send to checkout" moves the patient to *ready for checkout*.

**FR4 · Results to review**

- One list of all results not yet reviewed, oldest first, linked to the patient.
- "Mark reviewed" records who reviewed it and when, and removes it from the list.

**FR5 · Checkout (reception)**

- Shows outstanding checkout tasks and the patient's phone and email.
- Each task can be ticked off. "Complete visit" is enabled only when no tasks remain open, and moves the visit to *done*.

**FR6 · Study candidates (Diabetes study)**

- Matching runs at seed time and from a "Re-run matching" button. Re-running updates match status and evidence but never resets review, call or consent. The page lists every patient with match status *possible match* or *needs check*, plus the evidence and anything missing.
- **Doctor review:** approve for contact or dismiss, with an optional note. Approving sets the call status to *needs call*.
- **Reception call list:** approved patients still needing a call; log *reached* or *no answer*.
- **Consent:** after reaching a patient, reception records *consented* or *declined*. Until then consent stays *unknown*.
- Review, call and consent are three separate fields. Changing one never sets another, except that approval queues the call.

## Data model

The model uses nine tables (the patient record, the visit, which carries the handoff, and the study tracking), plus Better Auth's own tables (see Authentication and admin). Every "who" field (nurseId, doctorId, reviewedBy, consentBy) references user.id.

| Table | Key fields | Notes |
| --- | --- | --- |
| patients | id, name, dob (nullable), sex, phone, email | dob can be null, to exercise *needs check* |
| conditions | patientId, name, code, recordedAt | A documented diagnosis = a row here |
| medications | patientId, name, active |  |
| allergies | patientId, substance |  |
| results | patientId, test, value, unit, resultedAt, reviewedAt, reviewedBy | Unreviewed = reviewedAt is null |
| visits | patientId, reason, appointmentAt, arrivedAt, stage, urgent, preferredDoctor, nurseId, doctorId, bpSys, bpDia, weightKg, tempC, nurseNote, doctorNote | stage is an enum of the six stages + *scheduled* |
| checkoutTasks | visitId, label, done | Blocks checkout while any are open |
| studies | id, name, description | One seeded: Diabetes study |
| studyCandidates | studyId, patientId, matchStatus, evidenceJson, missingJson, reviewStatus, reviewedBy, callStatus, consentStatus, consentBy, notes, updatedAt | Status fields are independent; consentBy records who recorded consent |

**Enums**

- matchStatus: possible\_match · needs\_check · no\_match
- reviewStatus: pending · approved · dismissed
- callStatus: not\_started · needs\_call · reached · no\_answer
- consentStatus: unknown · consented · declined

## Study matching logic

The matcher points staff to evidence in the record; it never decides eligibility.

**Criteria (from the clinic owner):** adult AND a documented diagnosis of diabetes.

`matchPatient(patient, today) → { status, evidence[], missing[] }` is a pure function with no database access, so it can be unit-tested.

| Status | When | Evidence shown |
| --- | --- | --- |
| possible\_match | Age ≥ 18 AND a documented diabetes diagnosis | e.g. "Diagnosis: Type 2 diabetes, recorded 2023-04-02" and "Age 54" |
| needs\_check | Diagnosis present but date of birth missing; OR diabetes signs (metformin, insulin or an HbA1c result) without a documented diagnosis | The signs found + what's missing, e.g. "No documented diagnosis" |
| no\_match | Under 18, or no diabetes evidence at all | Not listed as a candidate |

**Rules**

- "Documented diagnosis" = a condition row whose name contains "diabetes" or whose code starts with E10–E14.
- Lab values are shown as context only. No thresholds or recency rules are applied, because none were confirmed.
- The UI never uses the word "eligible".

**Edge cases (seeded and unit-tested)**

| Patient | Expected |
| --- | --- |
| Adult with documented Type 2 diabetes | possible\_match |
| Adult on metformin, no diagnosis | needs\_check |
| Diabetes diagnosis, no date of birth | needs\_check |
| 17-year-old with Type 1 diabetes | no\_match |
| Adult with no diabetes evidence | no\_match |
| Patient turning 18 today, with diagnosis | possible\_match |

## Assumptions and open questions

These are our working assumptions where the owner left a decision open; each one also goes in the README.

| Assumption | Why | Ask the clinic |
| --- | --- | --- |
| The doctor reviews possible study matches | Owner said "staff"; a clinical judgment is safest with the doctor | Who should review matches? |
| Queue order: urgent first, then arrival time | Owner said arrivals and urgent cases change the order | Who can mark a patient urgent? |
| Preferred doctor is shown, but any doctor can take the patient | Owner said patients *may* have a particular doctor | Should a patient wait for their preferred doctor? |
| No lab thresholds, recency rules or medication exclusions | None were confirmed for the study | The study's full criteria |
| Access is a simple per-role scheme, managed by an admin | Owner asked us not to treat permissions as confirmed | Who may see clinical details? |
| No staff or patient-volume assumptions | Owner gave no reliable counts | — |
| Checkout tasks come from the doctor; reception ticks them off | Owner said reception sees what's left before the patient leaves | What usually happens at checkout? Should reception add tasks too? |

## Verification and build plan

The work is built in seven slices, and each one is checked before the next starts. Any slice still unfinished 10 minutes past its slot is cut and noted.

| Time | Slice | How it's verified |
| --- | --- | --- |
| 0:00–0:10 | Turn this PRD into a build spec with AI; review it against the PRD | Spec has no "eligible" wording, keeps consent separate, and treats missing data as *needs check* |
| 0:10–0:25 | Docker Compose (Postgres, Mailpit), Drizzle schema with Better Auth tables, seed, matcher | bun test passes on all 6 edge cases (hand-written fixtures, not the database); spot-check 3 seeded records |
| 0:25–0:45 | Magic-link sign-in, `requireUser`, admin page to add and deactivate staff | Sign in as each role; a nurse can't open the admin page; a deactivated user is blocked; signed in as reception, the doctor's patient page and results list are refused |
| 0:45–1:10 | Visit board + nurse step | Move one patient check-in → nurse → ready for doctor; board shows the nurse's name; urgent patient sorts first |
| 1:10–1:25 | Doctor step + results to review | Reason and nurse notes show first; mark a result reviewed and see it leave the list |
| 1:25–1:45 | Study candidates + review, call, consent | Approve a match and see consent stay *unknown*; reach the patient, then record consent |
| 1:45–1:52 | Checkout + README | Checkout is blocked with an open task, then allowed once it's done |
| 1:52–2:00 | Fresh-clone run test, end-to-end check, walkthrough | Run the README steps from a fresh clone with an empty database; then one patient through every role; record what was built, what was cut and the time spent |

**Seed data:** 2 doctors, 1 receptionist, 2 nurses and 1 admin (6 accounts); about 30 patients including the 6 edge cases; about 12 visits today across every stage, 1–2 urgent; about 8 unreviewed results. Nothing in the app depends on these counts.

**Submission:** a repo that runs locally. Requirements: Docker Desktop running and Bun 1.1+. Steps in the README:

1. `docker compose up -d` (starts Postgres on 5432 and Mailpit on 1025/8025)
2. `bun install`
3. `cp .env.example .env.local` (ships ready to use: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, SMTP localhost:1025)
4. `bun run db:push && bun run seed` (creates the clinic and auth tables, seeds patients and creates the 6 staff accounts)
5. `bun dev`, then open localhost:3000, enter a seeded staff email (listed in the README), and click the link in Mailpit at localhost:8025

`bun test` runs the matcher tests. `docker compose down -v` wipes the database for a fresh start. No accounts, API keys or internet connection are needed.
