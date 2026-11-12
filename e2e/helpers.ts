import { execSync } from "node:child_process";
import { type Browser, type BrowserContext, type Page, expect } from "@playwright/test";

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

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
  const context = await browser.newContext();
  const page = await context.newPage();
  const link = await requestLink(page, email);
  await page.goto(link);
  await page.waitForURL((u) => !u.pathname.startsWith("/api/") && u.pathname !== "/");
  return { context, page };
}

/** The board row (desktop table) for a patient. */
export const boardRow = (page: Page, patient: string) => page.getByTestId(`visit-${patient}`);
