/** Checkout actions (SPEC §8.3). */
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { checkoutTasks, visits } from "@/db/schema";
import { ALREADY_MOVED_ON, transitionVisit } from "@/lib/transition-visit";
import { type ActionResult, type Actor, type Db, NOT_ALLOWED, fail, idSchema, isAllowed, ok, parse } from "./common";

/** Tasks can be ticked while the doctor has the patient or at checkout, not after the visit is done. */
const TICKABLE_STAGES = ["with_doctor", "ready_for_checkout"] as const;

/**
 * Both checkout actions lock the visit row first. That puts a tick/untick and "Complete visit" on
 * the same visit in order, so an untick can't land just as the visit completes (which would leave
 * a done visit with an open task). Each statement after the lock sees the other's committed change.
 */
async function lockVisit(tx: Db, visitId: string) {
  const [row] = await tx.select({ id: visits.id, stage: visits.stage }).from(visits).where(eq(visits.id, visitId)).for("update");
  return row ?? null;
}

export async function toggleTask(db: Db, actor: Actor, taskId: unknown, done: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "toggleTask")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, taskId);
  if ("error" in id) return fail(id.error);
  const flag = parse(z.boolean(), done);
  if ("error" in flag) return fail(flag.error);

  return db.transaction(async (tx) => {
    const [task] = await tx.select({ visitId: checkoutTasks.visitId }).from(checkoutTasks).where(eq(checkoutTasks.id, id.data));
    if (!task) return fail("Task not found");
    const visit = await lockVisit(tx, task.visitId);
    if (!visit || !(TICKABLE_STAGES as readonly string[]).includes(visit.stage)) return fail("This task can't be changed now");
    await tx.update(checkoutTasks).set({ done: flag.data }).where(eq(checkoutTasks.id, id.data));
    return ok(flag.data ? "Task done" : "Task reopened");
  });
}

/** ready_for_checkout → done, only when no task is open (SPEC §8.3). The server re-checks; a stale page can't bypass it. */
export async function completeVisit(db: Db, actor: Actor, visitId: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "completeVisit")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);

  return db.transaction(async (tx) => {
    const visit = await lockVisit(tx, id.data);
    if (!visit || visit.stage !== "ready_for_checkout") return fail(ALREADY_MOVED_ON);
    const [{ open }] = await tx
      .select({ open: count() })
      .from(checkoutTasks)
      .where(and(eq(checkoutTasks.visitId, id.data), eq(checkoutTasks.done, false)));
    if (open > 0) return fail(`${open} ${open === 1 ? "task is" : "tasks are"} still open`);
    const r = await transitionVisit(tx, { visitId: id.data, from: "ready_for_checkout", to: "done" });
    return r.ok ? ok("Visit complete") : fail(r.error);
  });
}
