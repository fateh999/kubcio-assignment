import Link from "next/link";
import { getCurrentUser } from "@/lib/require-user";
import { isRole, type Role } from "@/lib/roles";
import { countUnreviewedResults } from "@/server/queries";
import { SignOutButton } from "./sign-out-button";

// Only links the signed-in role may open (SPEC §6.1).
const LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/board", label: "Visit board", roles: ["admin", "receptionist", "nurse", "doctor"] },
  { href: "/results", label: "Results", roles: ["nurse", "doctor"] },
  { href: "/studies", label: "Diabetes study", roles: ["doctor", "receptionist"] },
  { href: "/admin", label: "Staff", roles: ["admin"] },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  receptionist: "Reception",
  nurse: "Nurse",
  doctor: "Doctor",
};

export async function AppHeader() {
  const user = await getCurrentUser();
  if (!user || user.banned || !isRole(user.role)) return null;
  const role = user.role;
  // "Results (8)" for the roles that can see results (SPEC §10.4).
  const unreviewed = role === "nurse" || role === "doctor" ? await countUnreviewedResults() : null;

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold">
          Clinic
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm">
          {LINKS.filter((l) => l.roles.includes(role)).map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
              {l.href === "/results" && unreviewed !== null ? ` (${unreviewed})` : ""}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span data-testid="current-user">
            {user.name} · <span className="text-muted-foreground">{ROLE_LABEL[role]}</span>
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
