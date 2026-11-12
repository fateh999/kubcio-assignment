/** Results actions (SPEC §8.2). */
import { and, eq, isNull } from "drizzle-orm";
import { results } from "@/db/schema";
import { type ActionResult, type Actor, type Db, NOT_ALLOWED, fail, idSchema, isAllowed, ok, parse } from "./common";

/** Records who reviewed it and when. A result already reviewed is left as it is. */
export async function markReviewed(db: Db, actor: Actor, resultId: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "markReviewed")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, resultId);
  if ("error" in id) return fail(id.error);
  const updated = await db
    .update(results)
    .set({ reviewedAt: new Date(), reviewedBy: actor.id })
    .where(and(eq(results.id, id.data), isNull(results.reviewedAt)))
    .returning({ id: results.id });
  return updated.length === 1 ? ok("Marked reviewed") : fail("This result was already reviewed");
}
