import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for reviewers: `bun run test:e2e`.
 *
 * Builds the app and serves it on its own port (default 3100), so it never clashes with a dev
 * server on 3000. Magic links are read from Mailpit's API. Each spec file re-seeds the database
 * first, so files are independent and results are repeatable.
 *
 * Needs: `docker compose up -d`, `.env.local` (copied from .env.example), `bun run db:push`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One shared database: run files one after another.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
