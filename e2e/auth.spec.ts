/**
 * PRD: "Only staff an admin has added can sign in; each role lands on its own view, and non-admins
 * can't open the admin page." / "a deactivated (banned) user can't sign in or load any page."
 */
import { expect, test } from "@playwright/test";
import { STAFF, magicLinkFor, requestLink, reseed, signedIn } from "./helpers";

test.beforeAll(reseed);

test("signed-out visitors are redirected to sign-in (a real HTTP redirect)", async ({ page, request }) => {
  for (const path of ["/", "/board", "/admin", "/results", "/studies"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers().location, path).toContain("/sign-in");
  }
  await page.goto("/board");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("an unknown email gets the same message, and its link is refused", async ({ page }) => {
  const link = await requestLink(page, "stranger@example.com"); // same "if this email belongs to staff" message
  await page.goto(link);
  await expect(page).toHaveURL(/error=new_user_signup_disabled/);
  await expect(page.getByRole("alert").filter({ hasText: "isn't registered" })).toBeVisible();
});

test("each role lands on its own view", async ({ browser }) => {
  const cases = [
    { email: STAFF.admin, url: /\/admin$/, who: "Clinic Owner" },
    { email: STAFF.reception, url: /\/board\?view=reception/, who: "Rosa Mendes" },
    { email: STAFF.priya, url: /\/board\?view=nurse/, who: "Priya Shah" },
    { email: STAFF.khan, url: /\/board\?view=doctor/, who: "Dr Aisha Khan" },
  ];
  for (const c of cases) {
    const { context, page } = await signedIn(browser, c.email);
    await expect(page, c.email).toHaveURL(c.url);
    await expect(page.getByTestId("current-user")).toContainText(c.who);
    await context.close();
  }
});

test("a used link can't be used again", async ({ browser, page }) => {
  const link = await requestLink(page, STAFF.tom);
  const first = await browser.newContext();
  await (await first.newPage()).goto(link);
  await first.close();
  await page.goto(link);
  await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
});

test("access: nurse can't open admin; reception can't open the doctor page or results", async ({ browser }) => {
  const nurse = await signedIn(browser, STAFF.priya);
  await nurse.page.goto("/admin");
  await expect(nurse.page).toHaveURL(/\/forbidden$/);
  await expect(nurse.page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Staff" })).toHaveCount(0);
  await nurse.context.close();

  const reception = await signedIn(browser, STAFF.reception);
  for (const path of ["/results", "/visits/any-id/doctor", "/visits/any-id/nurse", "/admin"]) {
    await reception.page.goto(path);
    await expect(reception.page, path).toHaveURL(/\/forbidden$/);
  }
  await reception.context.close();
});

test("admin: add staff (invite email), change role, deactivate and reactivate", async ({ browser }) => {
  const admin = await signedIn(browser, STAFF.admin);
  const p = admin.page;
  const email = `new.nurse.${Date.now()}@clinic.test`;

  // Add staff → invite arrives in Mailpit.
  const since = Date.now();
  await p.getByRole("button", { name: "Add staff" }).click();
  await p.locator("#staff-name").fill("Dr Lena Ortiz");
  await p.locator("#staff-email").fill(email);
  await p.locator("#staff-role").click();
  await p.getByRole("option", { name: "Doctor" }).click();
  await p.getByRole("button", { name: "Add and send invite" }).click();
  await expect(p.getByText("Added Dr Lena Ortiz")).toBeVisible();
  const invite = await magicLinkFor(email, since);

  // Change role to nurse, then the invitee signs in and lands on the nurse view.
  await p.getByLabel("Role for Dr Lena Ortiz").click();
  await p.getByRole("option", { name: "Nurse" }).click();
  await expect(p.getByText("Role updated")).toBeVisible();
  const newbie = await browser.newContext();
  const np = await newbie.newPage();
  await np.goto(invite);
  await expect(np).toHaveURL(/\/board\?view=nurse/);

  // Deactivate: her open session stops working, and a new link is refused.
  await p.getByRole("button", { name: "Deactivate Dr Lena Ortiz" }).click();
  await expect(p.getByText("Their sessions were signed out")).toBeVisible();
  await np.goto("/board");
  await expect(np).toHaveURL(/\/sign-in/);
  const blocked = await requestLink(np, email);
  await np.goto(blocked);
  await expect(np.getByRole("alert").filter({ hasText: "deactivated" })).toBeVisible();

  // Reactivate: she can sign in again.
  await p.getByRole("button", { name: "Reactivate Dr Lena Ortiz" }).click();
  await expect(p.getByRole("button", { name: "Deactivate Dr Lena Ortiz" })).toBeVisible();
  await np.goto(await requestLink(np, email));
  await expect(np).toHaveURL(/\/board\?view=nurse/);

  // The admin can't deactivate themselves or change their own role.
  await expect(p.getByText("Can't deactivate yourself")).toBeVisible();
  await expect(p.getByLabel("Role for Clinic Owner")).toBeDisabled();

  await newbie.close();
  await admin.context.close();
});
