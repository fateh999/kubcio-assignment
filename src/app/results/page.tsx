import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #4 (FR4 · SPEC §10.4).
export default async function Page() {
  await requireUser(["nurse", "doctor"]);
  return <Placeholder title="Results to review" issue={4} spec="FR4 · SPEC §10.4" />;
}
