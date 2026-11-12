import { and, eq, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { visits } from "@/db/schema";
import { isAllowedTransition, type VisitStage } from "@/lib/visit-stages";

/** Shown when another click or another staff member already moved the visit (SPEC §7). */
export const ALREADY_MOVED_ON = "This patient has already moved on";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type VisitUpdate = Omit<Partial<typeof visits.$inferInsert>, "id" | "stage" | "patientId">;

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Moves one visit one stage forward as a single conditional update:
 *
 *   UPDATE visits SET stage = $to, ...set WHERE id = $visitId AND stage = $from AND ...where
 *
 * If no row matches (the visit already moved, or an extra condition such as "nurseId = me" fails),
 * nothing changes and the caller gets ALREADY_MOVED_ON. Because the check and the write are one
 * statement, double clicks and two staff taking the same patient can't both succeed.
 *
 * `from → to` must be a single step forward; anything else is a programming error and throws.
 */
export async function transitionVisit(
  db: DB | Tx,
  args: { visitId: string; from: VisitStage; to: VisitStage; set?: VisitUpdate; where?: SQL[] },
): Promise<TransitionResult> {
  const { visitId, from, to, set = {}, where = [] } = args;
  if (!isAllowedTransition(from, to)) {
    throw new Error(`Invalid visit transition ${from} → ${to}`);
  }

  const updated = await db
    .update(visits)
    .set({ ...set, stage: to })
    .where(and(eq(visits.id, visitId), eq(visits.stage, from), ...where))
    .returning({ id: visits.id });

  return updated.length === 1 ? { ok: true } : { ok: false, error: ALREADY_MOVED_ON };
}
