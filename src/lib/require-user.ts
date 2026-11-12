import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/** The signed-in user, or null. Does not redirect. */
export async function getCurrentUser(): Promise<(CurrentUser & { banned: boolean }) | null> {
  // Session checks compare expiry against the current time, so they must run at request time,
  // never during a prerender or prefetch.
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, role, banned } = session.user;
  return { id, name, email, role: role as Role, banned: banned === true };
}

/**
 * Guards every page and every server action (SPEC §5.4).
 * Redirects when there is no session, the user is deactivated (banned), or their role isn't allowed.
 * A missing or unknown role is never allowed.
 */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.banned) redirect("/sign-in?error=deactivated");
  if (!isRole(user.role)) redirect("/forbidden");
  if (roles && !roles.includes(user.role)) redirect("/forbidden");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
