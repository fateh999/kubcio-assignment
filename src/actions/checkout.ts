"use server";

// §8.3 server actions. Each: requireUser(ACTION_ROLES[name]) first, then the logic in
// src/server/checkout.ts (which re-checks the role and every precondition), then revalidate.

import { db } from "@/db";
import { requireUser } from "@/lib/require-user";
import { ACTION_ROLES, type ActionResult } from "@/server/common";
import { finish } from "@/server/finish";
import * as logic from "@/server/checkout";

export async function toggleTask(taskId: string, done: boolean): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.toggleTask]);
  return finish(await logic.toggleTask(db, user, taskId, done));
}

export async function completeVisit(visitId: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.completeVisit]);
  return finish(await logic.completeVisit(db, user, visitId));
}
