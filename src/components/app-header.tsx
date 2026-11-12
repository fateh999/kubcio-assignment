import { Stethoscope } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/require-user";
import { isRole, type Role } from "@/lib/roles";
import { countUnreviewedResults } from "@/server/queries";
import { NavLinks } from "./nav-links";
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

  const links = LINKS.filter((l) => l.roles.includes(role)).map((l) => ({
    href: l.href,
    label: l.href === "/results" && unreviewed !== null ? `${l.label} (${unreviewed})` : l.label,
  }));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">Clinic</span>
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
          <span data-testid="current-user" className="hidden lg:inline">
            <span className="font-medium">{user.name}</span> <span className="text-muted-foreground">· {ROLE_LABEL[role]}</span>
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
