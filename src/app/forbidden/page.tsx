import Link from "next/link";
import { getCurrentUser } from "@/lib/require-user";
import { DEFAULT_VIEW, isRole } from "@/lib/roles";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  const home = user && !user.banned && isRole(user.role) ? DEFAULT_VIEW[user.role] : "/sign-in";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-muted-foreground">You don&apos;t have access to this page.</p>
      <Link href={home} className="text-sm font-medium underline underline-offset-4">
        Go to your default view
      </Link>
    </main>
  );
}
