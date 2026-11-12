# Build log

Built with AI in one session on Nov 12, 2026. Each slice was checked before the next, and merged as a PR with its verification written up.

[← README](../README.md)

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
| Fresh-clone run test + final review | 1:52–2:00 | 17:30–17:58 (~28 min) | #18 | See below |
| *Extra, on request:* watchable e2e run | — | 18:00–18:13 (~13 min) | #19 | `test:e2e:report`: 17/17 with 28 videos (one per signed-in person), 17 traces, 30 screenshots, report opened and checked; `test:e2e:watch` (headed, slowed) and `test:e2e:ui` checked |

**Fresh-clone run (Nov 12, 2026):**
- **Setup:** cloned from GitHub into an empty folder, wiped the database with `docker compose down -v`, then followed the README exactly. Steps 1–4 took ~7 s: containers healthy, 585 packages, tables created, seed 10/10 expected statuses (4 possible match, 4 needs check, 22 no match).
- **Step 5:** port 3000 was taken by another dev server. `bun dev` moved to 3001 as described, and the README's fix (set `BETTER_AUTH_URL`) worked. In the browser: `/` → sign-in → link clicked **in Mailpit's web inbox** → reception board (7 in My queue). A walk-in added through the dialog showed as Checked in, 0 min.
- **Tests:** `bun test` 16/16 · `bun run test:db` 58/58 · `lint`, `typecheck`, `build` pass · `bun run test:e2e` **17/17**.

**Time:** the PRD's in-scope build (spec through README) took **~1 h 28 min** (15:14–16:42), inside the 2-hour budget. Polling, the UI pass, the e2e suite, walk-ins and the watchable e2e run were added afterwards on request, alongside the final review; the whole session was ~3 h (15:14–18:16).

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
