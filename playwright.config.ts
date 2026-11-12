import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for reviewers: `bun run test:e2e`.
 *
 * Ways to run it:
 *   bun run test:e2e          headless, fast (what CI / a quick check uses)
 *   bun run test:e2e:watch    a real Chrome window, slowed down so you can follow along
 *   bun run test:e2e:ui       Playwright's UI mode: pick tests, watch live, scrub the timeline
 *   bun run test:e2e:report   records video + screenshots + trace of every test, then opens the report
 *
 * Builds the app and serves it on its own port (default 3100), so it never clashes with a dev
 * server on 3000. Magic links are read from Mailpit's API. Each spec file re-seeds the database
 * first, so files are independent and results are repeatable.
 *
 * Needs: `docker compose up -d`, `.env.local` (copied from .env.example), `bun run db:push`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Slow each browser action down (ms) so a headed run can be followed by eye: `bun run test:e2e:watch`. */
const SLOW_MO = Number(process.env.E2E_SLOWMO ?? 0);
/** Record a video, screenshots and a trace of every test, for the HTML report: `bun run test:e2e:report`. */
const RECORD = process.env.E2E_RECORD === "1";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One shared database: run files one after another.
  fullyParallel: false,
  workers: 1,
  timeout: SLOW_MO ? 300_000 : 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: RECORD ? "on" : "retain-on-failure",
    screenshot: RECORD ? "on" : "only-on-failure",
    video: RECORD ? "on" : "retain-on-failure",
    launchOptions: { slowMo: SLOW_MO },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `bun run build && bunx next start -p ${PORT}`,
    url: `${BASE_URL}/sign-in`,
    timeout: 240_000,
    // Always start our own server, so AUTH_RATE_LIMIT and BETTER_AUTH_URL are guaranteed.
    reuseExistingServer: false,
    // Magic links must point at this server, not the dev server's port.
    // AUTH_RATE_LIMIT=off: the suite signs in dozens of times from one IP within seconds, far past
    // Better Auth's production limit (5 magic-link requests/minute). Only this test server sets it.
    env: { BETTER_AUTH_URL: BASE_URL, PORT: String(PORT), AUTH_RATE_LIMIT: "off" },
    stdout: "ignore",
    stderr: "pipe",
  },
});
