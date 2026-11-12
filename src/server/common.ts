/**
 * Shared pieces for the server-action logic in src/server/* (SPEC §8).
 *
 * Each action is split in two:
 *   - src/server/<area>.ts: the logic, `(db, actor, input)`. Role re-check, zod input, preconditions,
 *     conditional writes. No Next.js imports, so it's tested directly against Postgres.
 *   - src/actions/<area>.ts: the "use server" wrapper. requireUser(ACTION_ROLES[name]) first, then
 *     the logic, then revalidate.
 */
import { z } from "zod";
import type { DB } from "@/db";
import type { Role } from "@/lib/roles";

export type Actor = { id: string; role: Role };
export type ActionResult = { ok: string } | { error: string };
export type Db = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export const ok = (message: string): ActionResult => ({ ok: message });
export const fail = (message: string): ActionResult => ({ error: message });

/**
 * Who may call each action (SPEC §6, §8). The wrappers pass these to requireUser(), and the logic
 * re-checks them, so the rule holds even if the logic is called from somewhere else.
 */
export const ACTION_ROLES = {
  // §8.1 Visits
  checkIn: ["receptionist"],
  setUrgent: ["receptionist"],
  updateContact: ["receptionist"],
  addWalkIn: ["receptionist"],
  nurseTake: ["nurse"],
  saveVitals: ["nurse"],
  sendToDoctor: ["nurse"],
  doctorTake: ["doctor"],
  saveDoctorNote: ["doctor"],
  addCheckoutTask: ["doctor"],
  sendToCheckout: ["doctor"],
  // §8.2 Results
  markReviewed: ["doctor"],
  // §8.3 Checkout
  toggleTask: ["receptionist", "doctor"],
  completeVisit: ["receptionist"],
  // §8.4 Studies
  rerunMatching: ["doctor"],
  approveCandidate: ["doctor"],
  dismissCandidate: ["doctor"],
  logCall: ["receptionist"],
  recordConsent: ["receptionist"],
} as const satisfies Record<string, readonly Role[]>;

export type ActionName = keyof typeof ACTION_ROLES;

export const NOT_ALLOWED = "You don't have permission to do that";

export function isAllowed(actor: Actor, action: ActionName): boolean {
  return (ACTION_ROLES[action] as readonly Role[]).includes(actor.role);
}

export const idSchema = z.string().trim().min(1, "Missing id").max(100);

/** Parses input; returns the first error message as a failed ActionResult. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): { data: T } | { error: string } {
  const r = schema.safeParse(input);
  return r.success ? { data: r.data } : { error: r.error.issues[0]?.message ?? "Check the form" };
}

/** Optional note-like text: trimmed, empty → null, length-limited. */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is too long (max ${max} characters)`)
    .transform((s) => (s.trim() === "" ? null : s.trim()))
    .nullable()
    .optional();
