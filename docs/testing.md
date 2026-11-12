# Testing

[← README](../README.md)

## Commands

| Command | What it runs | Needs |
| --- | --- | --- |
| `bun test` | Study matcher (all 6 PRD edge cases; missing data never gives *possible match*; no eligibility wording) and visit-stage rules | `bun install` |
| `bun run test:db` | Against Postgres: stage transitions with concurrent staff; every server action's rules (role, stage, "only the assigned nurse/doctor", review/call/consent independence); checks that each action is guarded by the roles in the spec | Docker up and `bun run db:push` (the tests create and remove their own data) |
| `bun run test:e2e` | **End-to-end in a real browser (Playwright):** every PRD success criterion, signing in through real magic links from Mailpit. See below | Docker up, `.env.local`, `bun run db:push`, and once: `bunx playwright install chromium` |

`bun run lint`, `bun run typecheck` and `bun run build` also pass.

## End-to-end tests

```bash
docker compose up -d --wait
bun install
cp .env.example .env.local        # if you haven't already
bun run db:push
bunx playwright install chromium  # once
```

Then pick how you want to see it:

| Command | What you get |
| --- | --- |
| `bun run test:e2e:report` | **Easiest to review.** Runs everything while recording, then opens an HTML report. Every test has its steps, screenshots, a **video for each person signed in** (e.g. reception, nurse and doctor in the patient-journey test) and a **full trace** ("View Trace": scrub through each action with the page as it was). Stop the report server with Ctrl-C |
| `bun run test:e2e:watch` | Watch it live: a real Chrome window, slowed down (2 s per action) so you can follow each click and keystroke. A new window opens for each person who signs in. Takes a while at this speed: run one test with `bun run test:e2e:watch -g "walk-in"` |
| `bun run test:e2e:ui` | Playwright's UI mode: pick any test, run it, watch it live and step back and forth through its timeline |
| `bun run test:e2e` | Headless and fast (~40 s plus the build); just the pass/fail list |

Every mode builds the app and serves it on its own port (**3100**), so it doesn't clash with a dev server on 3000. Each spec file **re-seeds the database** first, so run it on a database you don't mind resetting. Afterwards `bun run seed` gives you a clean seeded state again.

### What each file covers

| File | PRD success criteria covered |
| --- | --- |
| `e2e/auth.spec.ts` | Signed-out redirect (real 307); an unknown email gets the same message and its link is refused; each role lands on its view; a used link is refused; nurse refused `/admin`, reception refused the doctor page and results; admin adds staff (invite email), changes role, deactivates (open session ends, new link refused) and reactivates; admin can't deactivate themselves |
| `e2e/visit-flow.spec.ts` | Board shows stage, who's handling, minutes waiting, urgent first; **one patient through every role** with the handoff shown first to the doctor; checkout blocked while a task is open, including from a **stale page** (server refuses); the board **updates on its own** when someone else acts; **walk-in** added by reception joins the nurse's queue in the right order |
| `e2e/results.spec.ts` | Unreviewed results oldest first; marking one removes it and the count drops; nurses can't mark |
| `e2e/study.spec.ts` | Possible match / needs check with evidence, no eligibility wording; approve → *Needs call*, **consent Unknown**; reached → still Unknown; reception records consent (with who); re-run keeps review/call/consent; dismissed patients never reach the call list |
| `e2e/access.spec.ts` | Reception's raw server responses (board, checkout, study) contain no diagnoses, medications, allergies, results or notes; the admin's board is read-only |

The test server runs with `AUTH_RATE_LIMIT=off`. The suite signs in dozens of times a minute, and Better Auth's production limit is 5 magic-link requests per minute per IP. Never set it for real use.
