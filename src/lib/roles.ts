export const ROLES = ["admin", "receptionist", "nurse", "doctor"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Where each role lands after sign-in (SPEC §5.3). */
export const DEFAULT_VIEW: Record<Role, string> = {
  admin: "/admin",
  receptionist: "/board?view=reception",
  nurse: "/board?view=nurse",
  doctor: "/board?view=doctor",
};
