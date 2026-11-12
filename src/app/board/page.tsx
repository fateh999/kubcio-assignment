import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #3 (FR1 · SPEC §10.1).
export default async function Page() {
  await requireUser(["admin", "receptionist", "nurse", "doctor"]);
  return <Placeholder title="Visit board" issue={3} spec="FR1 · SPEC §10.1" />;
}
