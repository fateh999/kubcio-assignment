/**
 * PRD: "Any role can see today's visits, each patient's current stage, who is handling them, and how
 * long they've waited." / "A patient moves through every stage, and each handoff shows the next
 * person what they need." / "The doctor's view shows the reason for visit and the nurse's notes above
 * everything else." / "Reception sees each patient's outstanding checkout tasks and can't complete
 * checkout while any remain open."
 */
import { expect, test } from "@playwright/test";
import { STAFF, boardRow, reseed, signedIn } from "./helpers";

test.beforeAll(reseed);

test("board: today's visits, urgent first, waiting time, who is handling them", async ({ browser }) => {
  const { context, page } = await signedIn(browser, STAFF.reception);
  await page.goto("/board?tab=checked_in");
  const rows = page.locator('tbody tr[data-testid^="visit-"]');
  // Samuel (urgent) arrived after Zofia but sorts first.
  await expect(rows.nth(0)).toContainText("Samuel Adeyemi");
  await expect(rows.nth(0)).toContainText("Urgent");
  await expect(rows.nth(1)).toContainText("Zofia Mazur");
  await expect(rows.nth(1)).toContainText(/\d+ min/);

  await page.goto("/board?tab=all");
  await expect(boardRow(page, "Victor Lambert")).toContainText("With nurse · Priya");
  await expect(boardRow(page, "Margaret Ellis")).toContainText("With doctor · Dr Khan");
  await expect(page.locator('tbody tr[data-testid^="visit-"]')).toHaveCount(12);
  await context.close();
});

test("one patient through every role: reception → nurse → doctor → reception", async ({ browser }) => {
  const reception = await signedIn(browser, STAFF.reception);
  const nurse = await signedIn(browser, STAFF.priya);
  const doctor = await signedIn(browser, STAFF.khan);

  // Reception checks Hannah in.
  await reception.page.goto("/board?tab=all");
  await boardRow(reception.page, "Hannah Lindqvist").getByRole("button", { name: "Check in" }).click();
  await expect(boardRow(reception.page, "Hannah Lindqvist")).toContainText("Checked in");

  // Nurse takes her; reception's board shows who has her.
  await nurse.page.goto("/board");
  await boardRow(nurse.page, "Hannah Lindqvist").getByRole("button", { name: "Take patient" }).click();
  await expect(nurse.page.getByTestId("reason")).toHaveText("Contraception review");
  await reception.page.reload();
  await expect(boardRow(reception.page, "Hannah Lindqvist")).toContainText("With nurse · Priya");

  // A typo is caught; then vitals go to the doctor.
  await nurse.page.locator("#bpSys").fill("1220");
  await nurse.page.locator("#bpDia").fill("78");
  await nurse.page.locator("#weightKg").fill("63.4");
  await nurse.page.locator("#tempC").fill("36.9");
  await nurse.page.locator("#nurseNote").fill("Wants to discuss switching method.");
  await nurse.page.getByRole("button", { name: "Send to doctor" }).click();
  // Scope to the main landmark: Next's route announcer is also role="alert".
  await expect(nurse.page.getByRole("main").getByRole("alert")).toHaveText("Systolic BP must be between 50 and 260");
  await nurse.page.locator("#bpSys").fill("122");
  await nurse.page.getByRole("button", { name: "Send to doctor" }).click();
  await expect(nurse.page).toHaveURL(/\/board/);

  // Doctor (not her preferred doctor) takes her; the handoff is the first thing on the page.
  await doctor.page.goto("/board");
  await boardRow(doctor.page, "Hannah Lindqvist").getByRole("button", { name: "Take patient" }).click();
  const handoff = doctor.page.getByTestId("handoff");
  await expect(handoff).toContainText("Contraception review");
  await expect(handoff).toContainText("122/78");
  await expect(handoff).toContainText("Priya Shah");
  await expect(handoff).toContainText("Wants to discuss switching method.");
  // The visible main only: Next keeps the previous page (the board) mounted but hidden.
  const order = await doctor.page
    .getByRole("main")
    .locator("[data-testid]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["handoff", "diagnoses", "medications", "allergies", "results"]);

  await doctor.page.getByLabel("New checkout task").fill("Book follow-up in 3 months");
  await doctor.page.getByRole("button", { name: "Add task" }).click();
  await expect(doctor.page.getByText("Task added")).toBeVisible();
  await doctor.page.locator("#doctorNote").fill("Switching method. Review in 3 months.");
  await doctor.page.getByRole("button", { name: "Send to checkout" }).click();
  await expect(doctor.page).toHaveURL(/\/board/);

  // Reception: checkout is blocked while the task is open, then allowed.
  await reception.page.goto("/board?tab=all");
  await boardRow(reception.page, "Hannah Lindqvist").getByRole("link", { name: "Checkout" }).click();
  const complete = reception.page.getByRole("button", { name: "Complete visit" });
  await expect(complete).toBeDisabled();
  await expect(reception.page.getByTestId("open-hint")).toHaveText("1 task still open");
  await expect(reception.page.getByRole("main")).not.toContainText("Switching method"); // no clinical notes at checkout
  await reception.page.getByRole("checkbox").click();
  await expect(reception.page.getByText("Task done")).toBeVisible();
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(reception.page).toHaveURL(/\/board/);
  await reception.page.goto("/board?tab=done");
  await expect(boardRow(reception.page, "Hannah Lindqvist")).toContainText("Seen by Dr Khan");

  for (const s of [reception, nurse, doctor]) await s.context.close();
});

test("checkout from a stale page is refused by the server", async ({ browser }) => {
  const reception = await signedIn(browser, STAFF.reception);
  const doctor = await signedIn(browser, STAFF.khan);

  await reception.page.goto("/board?tab=all");
  await boardRow(reception.page, "Tomasz Wrona").getByRole("link", { name: "Checkout" }).click();
  await reception.page.waitForURL(/\/checkout$/);
  const checkoutUrl = reception.page.url();
  await reception.page.locator("li", { hasText: "Book INR check" }).getByRole("checkbox").click();
  await expect(reception.page.getByRole("button", { name: "Complete visit" })).toBeEnabled();

  // Meanwhile the doctor reopens a task.
  await doctor.page.goto(checkoutUrl);
  await doctor.page.locator("li", { hasText: "Print dosing schedule" }).getByRole("checkbox").click();
  await expect(doctor.page.getByText("Task reopened")).toBeVisible();

  // Reception's page still shows the button enabled; the server refuses.
  await reception.page.getByRole("button", { name: "Complete visit" }).click();
  await expect(reception.page.getByText("1 task is still open")).toBeVisible();
  await reception.page.goto("/board?tab=ready_for_checkout");
  await expect(boardRow(reception.page, "Tomasz Wrona")).toBeVisible();

  await reception.context.close();
  await doctor.context.close();
});

test("the board updates on its own (polling) when someone else acts", async ({ browser }) => {
  const watcher = await signedIn(browser, STAFF.reception);
  const actor = await signedIn(browser, STAFF.reception);
  await watcher.page.goto("/board?tab=all");
  await expect(boardRow(watcher.page, "Robert Hughes")).toContainText("Scheduled");

  await actor.page.goto("/board?tab=all");
  await boardRow(actor.page, "Robert Hughes").getByRole("button", { name: "Check in" }).click();
  await expect(boardRow(actor.page, "Robert Hughes")).toContainText("Checked in");

  // No reload on the watcher: the 10 s poll picks it up.
  await expect(boardRow(watcher.page, "Robert Hughes")).toContainText("Checked in", { timeout: 15_000 });
  await watcher.context.close();
  await actor.context.close();
});
