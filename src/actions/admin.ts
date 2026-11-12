"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { ROLES } from "@/lib/roles";

// Staff accounts (SPEC §5.5, §8.5). Admin only; every action re-checks the role.

export type ActionResult = { ok: string } | { error: string };

const roleSchema = z.enum(ROLES);
const addStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  role: roleSchema,
});

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof APIError) return err.body?.message ?? err.message ?? fallback;
  return fallback;
}

export async function addStaff(input: { name: string; email: string; role: string }): Promise<ActionResult> {
  await requireUser(["admin"]);
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { name, email, role } = parsed.data;
  const h = await headers();

  try {
    // No password: magic-link-only users (the installed Better Auth allows this).
    await auth.api.createUser({ body: { name, email, role: role as "admin" }, headers: h });
  } catch (err) {
    const code = err instanceof APIError ? String(err.body?.code ?? "") : "";
    if (code.includes("ALREADY_EXISTS")) return { error: "Already a staff member" };
    return { error: apiErrorMessage(err, "Couldn't add staff member") };
  }

  // Invite = a normal magic link sent to the new staff member (SPEC §16 #4). The admin's session is untouched.
  try {
    await auth.api.signInMagicLink({ body: { email, callbackURL: "/", errorCallbackURL: "/sign-in" }, headers: h });
  } catch {
    revalidatePath("/admin");
    return { ok: `Added ${name}, but the invite email failed. They can request a link on the sign-in page.` };
  }

  revalidatePath("/admin");
  return { ok: `Added ${name}. A sign-in link was sent to ${email}.` };
}

export async function changeRole(userId: string, role: string): Promise<ActionResult> {
  const me = await requireUser(["admin"]);
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { error: "Unknown role" };
  if (userId === me.id) return { error: "You can't change your own role" };

  try {
    await auth.api.setRole({ body: { userId, role: parsed.data as "admin" }, headers: await headers() });
  } catch (err) {
    return { error: apiErrorMessage(err, "Couldn't change role") };
  }
  revalidatePath("/admin");
  return { ok: "Role updated" };
}

export async function deactivateStaff(userId: string): Promise<ActionResult> {
  const me = await requireUser(["admin"]);
  if (userId === me.id) return { error: "You can't deactivate yourself" };

  try {
    // banUser also revokes all of their sessions.
    await auth.api.banUser({ body: { userId }, headers: await headers() });
  } catch (err) {
    return { error: apiErrorMessage(err, "Couldn't deactivate") };
  }
  revalidatePath("/admin");
  return { ok: "Deactivated. Their sessions were signed out." };
}

export async function reactivateStaff(userId: string): Promise<ActionResult> {
  await requireUser(["admin"]);
  try {
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
  } catch (err) {
    return { error: apiErrorMessage(err, "Couldn't reactivate") };
  }
  revalidatePath("/admin");
  return { ok: "Reactivated" };
}
