import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #3 (FR2 · SPEC §10.2).
export default async function Page() {
  await requireUser(["nurse"]);
  return <Placeholder title="Nurse step" issue={3} spec="FR2 · SPEC §10.2" />;
}
