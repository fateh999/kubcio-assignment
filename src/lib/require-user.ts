import type { Role } from "@/lib/roles";

/**
 * Guards every page and server action (SPEC §5.4). Implemented in #2.
 *
 * Until then it refuses everything, so nothing can be wired to it by mistake and appear protected.
 */
export async function requireUser(roles?: Role[]): Promise<never> {
  void roles;
  throw new Error("requireUser is not implemented yet (task #2)");
}
