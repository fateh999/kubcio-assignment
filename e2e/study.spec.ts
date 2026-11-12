/**
 * PRD: the matcher returns possible match, needs check or no match, each with evidence, and never
 * uses eligibility wording. / "Consent stays unknown until reception records it after reaching the
 * patient; approval and call status never set consent."
 */
import { expect, test } from "@playwright/test";
import { STAFF, reseed, signedIn } from "./helpers";

test.beforeAll(reseed);

test("approve → call → consent, with consent untouched until reception records it", async ({ browser }) => {
  const doctor = await signedIn(browser, STAFF.khan);
  const reception = await signedIn(browser, STAFF.reception);
  const d = doctor.page;
  const r = reception.page;

  // Doctor's list: candidates with evidence and missing items, and no eligibility wording.
  await d.goto("/studies");
  const table = d.locator("table");
  await expect(table.getByText("Possible match")).toHaveCount(4);
  await expect(table.getByText("Needs check")).toHaveCount(4);
  await expect(d.getByTestId("candidate-Sunita Rao")).toContainText("Missing: Date of birth");
  await expect(d.getByTestId("candidate-Margaret Ellis")).toContainText("Diagnosis: Type 2 diabetes (E11.9)");
  expect(await d.locator("body").innerText()).not.toMatch(/eligib/i);

  // Approve: call queued, consent stays Unknown.
  const margaret = d.getByTestId("candidate-Margaret Ellis");
  await margaret.getByRole("button", { name: "Approve for contact" }).click();
  await d.getByRole("dialog").getByLabel("Note (optional)").fill("Keen on research");
  await d.getByRole("dialog").getByRole("button", { name: "Approve for contact" }).click();
  await expect(margaret).toContainText("Needs call");
  await expect(margaret).toContainText("Unknown");

  // Reception: call list, without any evidence (it contains diagnoses).
  await r.goto("/studies");
  await expect(r.getByTestId("call-Margaret Ellis")).toBeVisible();
  const raw = await (await r.request.get("/studies")).text();
  for (const clinical of ["Diagnosis:", "E11.9", "Metformin", "HbA1c", "Keen on research"]) expect(raw, clinical).not.toContain(clinical);

  // Reached: consent still Unknown.
  await r.getByRole("button", { name: "Reached Margaret Ellis" }).click();
  await expect(r.getByText("No one to call.")).toBeVisible();
  await r.getByRole("tab", { name: /Consent/ }).click();
  await expect(r.getByTestId("consent-Margaret Ellis")).toContainText("Unknown");

  // Only now does reception record consent, and who recorded it.
  await r.getByRole("button", { name: "Margaret Ellis consented" }).click();
  await expect(r.getByTestId("consent-Margaret Ellis")).toContainText("Consented · recorded by Rosa Mendes");
  await expect(r.getByTestId("consent-Margaret Ellis").getByRole("button")).toHaveCount(0);

  // Re-running matching keeps review, call and consent.
  await d.reload();
  await d.getByRole("button", { name: "Re-run matching" }).click();
  await expect(d.getByText(/Matched 8 patients/)).toBeVisible();
  await expect(margaret).toContainText("Approved for contact");
  await expect(margaret).toContainText("Reached");
  await expect(margaret).toContainText("Consented");

  await doctor.context.close();
  await reception.context.close();
});

test("dismissed candidates never reach the call list", async ({ browser }) => {
  const doctor = await signedIn(browser, STAFF.khan);
  const reception = await signedIn(browser, STAFF.reception);
  await doctor.page.goto("/studies");
  const noah = doctor.page.getByTestId("candidate-Noah Fischer");
  await noah.getByRole("button", { name: "Dismiss" }).click();
  await doctor.page.getByRole("dialog").getByRole("button", { name: "Dismiss" }).click();
  await expect(noah).toContainText("Dismissed");
  await expect(noah).toContainText("Not started");
  await reception.page.goto("/studies");
  await expect(reception.page.getByTestId("call-Noah Fischer")).toHaveCount(0);
  await doctor.context.close();
  await reception.context.close();
});
