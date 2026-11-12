import { Placeholder } from "@/components/placeholder";
import { requireUser } from "@/lib/require-user";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Built in #6 (FR5 · SPEC §10.5).
export default async function Page() {
  await requireUser(["receptionist", "doctor"]);
  return <Placeholder title="Checkout" issue={6} spec="FR5 · SPEC §10.5" />;
}
