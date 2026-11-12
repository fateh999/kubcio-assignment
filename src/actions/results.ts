"use server";

// §8.2 server actions. Each: requireUser(ACTION_ROLES[name]) first, then the logic in
// src/server/results.ts (which re-checks the role and every precondition), then revalidate.

import { db } from "@/db";
import { requireUser } from "@/lib/require-user";
import { ACTION_ROLES, type ActionResult } from "@/server/common";
import { finish } from "@/server/finish";
import * as logic from "@/server/results";

export async function markReviewed(resultId: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.markReviewed]);
  return finish(await logic.markReviewed(db, user, resultId));
}
