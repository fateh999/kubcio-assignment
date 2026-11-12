"use server";

// §8.4 server actions. Each: requireUser(ACTION_ROLES[name]) first, then the logic in
// src/server/studies.ts (which re-checks the role and every precondition), then revalidate.

import { db } from "@/db";
import { requireUser } from "@/lib/require-user";
import { ACTION_ROLES, type ActionResult } from "@/server/common";
import { finish } from "@/server/finish";
import * as logic from "@/server/studies";

export async function rerunMatching(): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.rerunMatching]);
  return finish(await logic.rerunMatching(db, user));
}

export async function approveCandidate(candidateId: string, note?: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.approveCandidate]);
  return finish(await logic.approveCandidate(db, user, candidateId, note));
}

export async function dismissCandidate(candidateId: string, note?: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.dismissCandidate]);
  return finish(await logic.dismissCandidate(db, user, candidateId, note));
}

export async function logCall(candidateId: string, outcome: "reached" | "no_answer"): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.logCall]);
  return finish(await logic.logCall(db, user, candidateId, outcome));
}

export async function recordConsent(candidateId: string, value: "consented" | "declined"): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.recordConsent]);
  return finish(await logic.recordConsent(db, user, candidateId, value));
}
