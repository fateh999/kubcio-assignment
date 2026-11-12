import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #4 (FR3 · SPEC §10.3).
export default async function Page() {
  await requireUser(["doctor"]);
  return <Placeholder title="Doctor step" issue={4} spec="FR3 · SPEC §10.3" />;
}
