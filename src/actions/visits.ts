"use server";

// §8.1 server actions. Each: requireUser(ACTION_ROLES[name]) first, then the logic in
// src/server/visits.ts (which re-checks the role and every precondition), then revalidate.

import { db } from "@/db";
import { requireUser } from "@/lib/require-user";
import { ACTION_ROLES, type ActionResult } from "@/server/common";
import { finish } from "@/server/finish";
import * as logic from "@/server/visits";
import type { VitalsInput } from "@/server/visits";

export async function checkIn(visitId: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.checkIn]);
  return finish(await logic.checkIn(db, user, visitId));
}

export async function setUrgent(visitId: string, urgent: boolean): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.setUrgent]);
  return finish(await logic.setUrgent(db, user, visitId, urgent));
}

export async function updateContact(patientId: string, contact: { phone: string; email: string }): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.updateContact]);
  return finish(await logic.updateContact(db, user, patientId, contact));
}

export async function nurseTake(visitId: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.nurseTake]);
  return finish(await logic.nurseTake(db, user, visitId));
}

export async function saveVitals(visitId: string, vitals: VitalsInput): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.saveVitals]);
  return finish(await logic.saveVitals(db, user, visitId, vitals));
}

export async function sendToDoctor(visitId: string, vitals?: VitalsInput): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.sendToDoctor]);
  return finish(await logic.sendToDoctor(db, user, visitId, vitals));
}

export async function doctorTake(visitId: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.doctorTake]);
  return finish(await logic.doctorTake(db, user, visitId));
}

export async function saveDoctorNote(visitId: string, note: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.saveDoctorNote]);
  return finish(await logic.saveDoctorNote(db, user, visitId, note));
}

export async function addCheckoutTask(visitId: string, label: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.addCheckoutTask]);
  return finish(await logic.addCheckoutTask(db, user, visitId, label));
}

export async function sendToCheckout(visitId: string, note?: string): Promise<ActionResult> {
  const user = await requireUser([...ACTION_ROLES.sendToCheckout]);
  return finish(await logic.sendToCheckout(db, user, visitId, note));
}
