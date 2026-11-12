import { redirect } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { DEFAULT_VIEW } from "@/lib/roles";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// "/" sends each role to its own default view (SPEC §5.3).
export default async function Home() {
  const user = await requireUser();
  redirect(DEFAULT_VIEW[user.role]);
}
