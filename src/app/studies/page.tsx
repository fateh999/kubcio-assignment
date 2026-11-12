import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #5 (FR6 · SPEC §10.6).
export default async function Page() {
  await requireUser(["doctor", "receptionist"]);
  return <Placeholder title="Diabetes study" issue={5} spec="FR6 · SPEC §10.6" />;
}
