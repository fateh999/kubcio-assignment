/** PRD: "Unreviewed results appear in one list and leave it when the doctor marks them reviewed." */
import { expect, test } from "@playwright/test";
import { STAFF, reseed, signedIn } from "./helpers";

test.beforeAll(reseed);

test("doctor marks the oldest result reviewed; it leaves the list and the count drops", async ({ browser }) => {
  const { context, page } = await signedIn(browser, STAFF.khan);
  await page.goto("/results");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Results (8)" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(rows.first()).toContainText("Margaret Ellis"); // oldest first

  await page.getByRole("button", { name: "Mark Margaret Ellis HbA1c reviewed" }).click();
  await expect(rows).toHaveCount(7);
  await expect(page.locator("tbody")).not.toContainText("Margaret Ellis");
  await expect(nav.getByRole("link", { name: "Results (7)" })).toBeVisible();
  await context.close();
});

test("nurses see the list but can't mark results reviewed", async ({ browser }) => {
  const { context, page } = await signedIn(browser, STAFF.priya);
  await page.goto("/results");
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /reviewed/ })).toHaveCount(0);
  await context.close();
});
