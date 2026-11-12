# Clinic Management Prototype

A small clinic's visit handoff (reception → nurse → doctor → reception), results waiting for review, and diabetes-study candidates, where a match is never treated as eligibility or consent. Synthetic data; runs locally with no accounts or keys.

[PRD](./Clinic%20Management%20Prototype%20—%20PRD.md) · [Spec](./SPEC.md) · [Testing](./docs/testing.md) · [Build log](./docs/build-log.md)

## Run it

Needs Docker Desktop and Bun 1.1+.

```bash
docker compose up -d --wait
bun install
cp .env.example .env.local
bun run db:push && bun run seed
bun dev                              # http://localhost:3000
```

Sign in with an email below and click the link in **Mailpit (http://localhost:8025)**.

`reception@clinic.test` · `priya@clinic.test` (nurse) · `khan@clinic.test` (doctor) · `admin@clinic.test` (all six staff: SPEC §11)

If port 3000 is taken, set `BETTER_AUTH_URL` in `.env.local` to the port `bun dev` uses.

## Review it

```bash
bunx playwright install chromium     # once
bun run test:e2e:report              # ~2 min; opens a report with a video and trace per test
```

The tests reset the local database. Use `bun run test:e2e:watch` to watch live.

| PRD success criterion | Where to see it |
| --- | --- |
| Only added staff sign in; each role has its own view | Sign in as each role; try `stranger@example.com` |
| Access rules hold (reception can't see clinical data; deactivated users are blocked) | As reception, open `/results`; as admin, deactivate someone |
| Board shows stage, who's handling, minutes waiting | Board: urgent Samuel above Zofia, who arrived first |
| Patient moves through every stage; doctor sees reason and nurse notes first | Check in Hannah → nurse → doctor |
| Checkout blocked while tasks are open | Doctor adds a task; reception's Complete visit stays disabled |
| Unreviewed results leave the list when reviewed | Doctor: Results (8) → Mark reviewed → 7 |
| Matcher shows evidence, no eligibility wording; missing data → *needs check* | Diabetes study: Sunita "Missing: Date of birth" |
| Consent stays unknown until reception records it | Approve Margaret → call → consent, in that order |

Also added on request: **walk-ins** (reception adds a patient without an appointment).

## Decisions and limits

- **PRD contradictions:** only the doctor adds checkout tasks; reception never sees study evidence (it contains diagnoses).
- **To confirm with the clinic:** the doctor reviews study matches; urgent first, then by arrival; any doctor can take any patient.
- **Limits:** access is enforced in the app, not the database; the board polls every 10 s; a walk-in always creates a new patient record.

## Summary

The in-scope build took **~1 h 28 min**, inside the 2-hour budget, with nothing cut. From a fresh clone: `bun test` 16/16, `test:db` 58/58, `test:e2e` 17/17, and lint, typecheck and build pass. Details: [build log](./docs/build-log.md).
