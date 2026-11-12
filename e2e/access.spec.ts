/**
 * PRD: "The access rules hold on every page and server action: reception can't read diagnoses,
 * medications, allergies or results."
 *
 * Checks the raw server responses for reception, not just what's visible on screen.
 */
import { expect, test } from "@playwright/test";
import { STAFF, boardRow, reseed, signedIn } from "./helpers";

test.beforeAll(reseed);

// Seeded clinical data that must never reach reception (diagnoses, medications, allergies, results, notes).
const CLINICAL = [
  "Type 2 diabetes",
  "Atrial fibrillation",
  "Hypertension",
  "Metformin",
  "Apixaban",
  "Penicillin",
  "Aspirin",
  "Ferritin",
  "INR in range", // doctor note
  "No bleeding or bruising", // nurse note
];

test("reception's pages never contain clinical data", async ({ browser }) => {
  const { context, page } = await signedIn(browser, STAFF.reception);
  await page.goto("/board?tab=all");
  const checkoutHref = await boardRow(page, "Tomasz Wrona").getByRole("link", { name: "Checkout" }).getAttribute("href");
  for (const path of ["/board?tab=all", checkoutHref!, "/studies"]) {
    const html = await (await page.request.get(path)).text();
    for (const word of CLINICAL) expect(html, `${path} contains "${word}"`).not.toContain(word);
  }
  await context.close();
});

test("the admin's board is read-only", async ({ browser }) => {
  const { context, page } = await signedIn(browser, STAFF.admin);
  await page.goto("/board?tab=all");
  await expect(page.locator('tbody tr[data-testid^="visit-"]')).toHaveCount(12);
  await expect(page.locator("tbody").getByRole("button")).toHaveCount(0);
  await context.close();
});
