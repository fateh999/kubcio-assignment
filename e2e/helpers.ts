import { execSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** `bun run test:e2e:report` sets this: record a video of every signed-in browser, attached to the test. */
const RECORD = process.env.E2E_RECORD === "1";

/** Seeded staff (SPEC §11). */
export const STAFF = {
  admin: "admin@clinic.test",
  reception: "reception@clinic.test",
  priya: "priya@clinic.test",
  tom: "tom@clinic.test",
  khan: "khan@clinic.test",
  nowak: "nowak@clinic.test",
} as const;

/** Resets the database to the seeded state and clears the Mailpit inbox. */
export async function reseed() {
  execSync("bun run seed", { stdio: "pipe" });
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

/** Waits for a magic link sent to `email` after `since`, and returns it. */
export async function magicLinkFor(email: string, since: number): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`);
    const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= since - 1000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)).json()) as { Text: string };
      const link = msg.Text.match(/https?:\/\/\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No magic link arrived in Mailpit for ${email}`);
}

/** Requests a link on the sign-in page, like a person would. Returns the emailed link. */
export async function requestLink(page: Page, email: string): Promise<string> {
  const since = Date.now();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("If this email belongs to clinic staff")).toBeVisible();
  return magicLinkFor(email, since);
}

/** A fresh browser (own cookies) signed in as `email` through the real magic-link flow. */
export async function signedIn(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const info = test.info();
  const context = await browser.newContext(
    RECORD ? { recordVideo: { dir: info.outputPath("videos"), size: { width: 1280, height: 800 } } } : {},
  );
  const page = await context.newPage();
  if (RECORD) {
    // Playwright's `video` option only covers its own default context, so attach these by hand,
    // labelled by who is signed in. The video file is written when the context closes.
    const close = context.close.bind(context);
    context.close = async (options) => {
      const video = page.video();
      await close(options);
      if (!video) return;
      const path = await video.path();
      await info.attach(`video: ${email}`, { path, contentType: "video/webm" }); // copies it into the report
      await unlink(path).catch(() => {});
    };
  }
  const link = await requestLink(page, email);
  await page.goto(link);
  await page.waitForURL((u) => !u.pathname.startsWith("/api/") && u.pathname !== "/");
  return { context, page };
}

/** The board row (desktop table) for a patient. */
export const boardRow = (page: Page, patient: string) => page.getByTestId(`visit-${patient}`);
