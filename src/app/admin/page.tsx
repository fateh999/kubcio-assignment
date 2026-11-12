import { asc } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { isRole } from "@/lib/roles";
import { PageHeader } from "@/components/ui-kit";
import { StaffTable } from "./staff-table";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Staff accounts (SPEC §5.5). Admin only.
export default async function AdminPage() {
  const me = await requireUser(["admin"]);
  const staff = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned })
    .from(user)
    .orderBy(asc(user.name));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader title="Staff accounts" description="Add staff, change roles, deactivate accounts. New staff get a sign-in link by email." />
      <StaffTable
        currentUserId={me.id}
        staff={staff.map((s) => ({ ...s, role: isRole(s.role) ? s.role : null, active: s.banned !== true }))}
      />
    </main>
  );
}
