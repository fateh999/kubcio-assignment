/**
 * Read queries for the screens (SPEC §10). Each one selects only what its screen may show (SPEC §6):
 * the board, checkout and reception's study tabs never touch diagnoses, medications, allergies,
 * results, notes or study evidence.
 */
import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  allergies,
  checkoutTasks,
  conditions,
  medications,
  patients,
  results,
  studyCandidates,
  user,
  visits,
} from "@/db/schema";

export function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

// ---------- §10.1 Board (all roles, no clinical data) ----------

export async function getBoard(now: Date) {
  const nurse = alias(user, "nurse");
  const doctor = alias(user, "doctor");
  const preferred = alias(user, "preferred");
  const { start, end } = todayRange(now);
  return db
    .select({
      id: visits.id,
      patientName: patients.name,
      reason: visits.reason,
      appointmentAt: visits.appointmentAt,
      arrivedAt: visits.arrivedAt,
      stage: visits.stage,
      urgent: visits.urgent,
      nurseId: visits.nurseId,
      doctorId: visits.doctorId,
      nurseName: nurse.name,
      doctorName: doctor.name,
      preferredDoctorName: preferred.name,
    })
    .from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .leftJoin(nurse, eq(nurse.id, visits.nurseId))
    .leftJoin(doctor, eq(doctor.id, visits.doctorId))
    .leftJoin(preferred, eq(preferred.id, visits.preferredDoctor))
    .where(and(gte(visits.appointmentAt, start), lt(visits.appointmentAt, end)))
    // Urgent first, then arrival time; appointment time only orders not-yet-arrived rows.
    .orderBy(desc(visits.urgent), sql`${visits.arrivedAt} asc nulls last`, asc(visits.appointmentAt));
}
export type BoardRow = Awaited<ReturnType<typeof getBoard>>[number];

// ---------- §10.2 Nurse step ----------

export async function getNurseVisit(visitId: string) {
  const nurse = alias(user, "nurse");
  const [row] = await db
    .select({
      id: visits.id,
      stage: visits.stage,
      urgent: visits.urgent,
      reason: visits.reason,
      nurseId: visits.nurseId,
      nurseName: nurse.name,
      bpSys: visits.bpSys,
      bpDia: visits.bpDia,
      weightKg: visits.weightKg,
      tempC: visits.tempC,
      nurseNote: visits.nurseNote,
      patientName: patients.name,
      dob: patients.dob,
    })
    .from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .leftJoin(nurse, eq(nurse.id, visits.nurseId))
    .where(eq(visits.id, visitId));
  return row ?? null;
}

// ---------- §10.3 Doctor step ----------

export async function getDoctorVisit(visitId: string) {
  const nurse = alias(user, "nurse");
  const doctor = alias(user, "doctor");
  const [visit] = await db
    .select({
      id: visits.id,
      stage: visits.stage,
      urgent: visits.urgent,
      reason: visits.reason,
      patientId: visits.patientId,
      patientName: patients.name,
      dob: patients.dob,
      nurseName: nurse.name,
      doctorId: visits.doctorId,
      doctorName: doctor.name,
      bpSys: visits.bpSys,
      bpDia: visits.bpDia,
      weightKg: visits.weightKg,
      tempC: visits.tempC,
      nurseNote: visits.nurseNote,
      doctorNote: visits.doctorNote,
    })
    .from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .leftJoin(nurse, eq(nurse.id, visits.nurseId))
    .leftJoin(doctor, eq(doctor.id, visits.doctorId))
    .where(eq(visits.id, visitId));
  if (!visit) return null;

  const [dx, meds, allergyRows, resultRows, tasks] = await Promise.all([
    db.select().from(conditions).where(eq(conditions.patientId, visit.patientId)).orderBy(desc(conditions.recordedAt)),
    db.select().from(medications).where(and(eq(medications.patientId, visit.patientId), eq(medications.active, true))).orderBy(asc(medications.name)),
    db.select().from(allergies).where(eq(allergies.patientId, visit.patientId)).orderBy(asc(allergies.substance)),
    db.select().from(results).where(eq(results.patientId, visit.patientId)).orderBy(desc(results.resultedAt)).limit(20),
    db.select().from(checkoutTasks).where(eq(checkoutTasks.visitId, visitId)).orderBy(asc(checkoutTasks.done), asc(checkoutTasks.label)),
  ]);
  return { visit, conditions: dx, medications: meds, allergies: allergyRows, results: resultRows, tasks };
}

// ---------- §10.4 Results to review ----------

export async function getUnreviewedResults(now: Date) {
  const { start, end } = todayRange(now);
  return db
    .select({
      id: results.id,
      test: results.test,
      value: results.value,
      unit: results.unit,
      resultedAt: results.resultedAt,
      patientName: patients.name,
      // Today's visit for this patient, if any (for the link to the doctor page). Raw-SQL params are
      // passed as ISO strings: the postgres-js driver only serialises Date values bound to a column.
      todayVisitId: sql<string | null>`(
        select ${visits.id} from ${visits}
        where ${visits.patientId} = ${results.patientId}
          and ${visits.appointmentAt} >= ${start.toISOString()}::timestamptz
          and ${visits.appointmentAt} < ${end.toISOString()}::timestamptz
        limit 1)`,
    })
    .from(results)
    .innerJoin(patients, eq(patients.id, results.patientId))
    .where(isNull(results.reviewedAt))
    .orderBy(asc(results.resultedAt));
}

export async function countUnreviewedResults() {
  const [{ n }] = await db.select({ n: count() }).from(results).where(isNull(results.reviewedAt));
  return n;
}

// ---------- §10.5 Checkout (no clinical data) ----------

export async function getCheckoutVisit(visitId: string) {
  const [visit] = await db
    .select({
      id: visits.id,
      stage: visits.stage,
      patientId: patients.id,
      patientName: patients.name,
      phone: patients.phone,
      email: patients.email,
    })
    .from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .where(eq(visits.id, visitId));
  if (!visit) return null;
  const tasks = await db
    .select({ id: checkoutTasks.id, label: checkoutTasks.label, done: checkoutTasks.done })
    .from(checkoutTasks)
    .where(eq(checkoutTasks.visitId, visitId))
    .orderBy(asc(checkoutTasks.done), asc(checkoutTasks.label));
  return { visit, tasks };
}

// ---------- §10.6 Study candidates ----------

/** Doctor's review list: every listed candidate with evidence and missing items. */
export async function getStudyReviewList() {
  return db
    .select({
      id: studyCandidates.id,
      patientName: patients.name,
      matchStatus: studyCandidates.matchStatus,
      evidence: studyCandidates.evidenceJson,
      missing: studyCandidates.missingJson,
      reviewStatus: studyCandidates.reviewStatus,
      callStatus: studyCandidates.callStatus,
      consentStatus: studyCandidates.consentStatus,
      notes: studyCandidates.notes,
    })
    .from(studyCandidates)
    .innerJoin(patients, eq(patients.id, studyCandidates.patientId))
    .where(inArray(studyCandidates.matchStatus, ["possible_match", "needs_check"]))
    .orderBy(asc(studyCandidates.matchStatus), asc(patients.name));
}

/** Reception's call list. No evidence, which contains diagnoses (SPEC §16 #2). */
export async function getCallList() {
  return db
    .select({
      id: studyCandidates.id,
      patientName: patients.name,
      phone: patients.phone,
      callStatus: studyCandidates.callStatus,
      updatedAt: studyCandidates.updatedAt,
    })
    .from(studyCandidates)
    .innerJoin(patients, eq(patients.id, studyCandidates.patientId))
    .where(and(eq(studyCandidates.reviewStatus, "approved"), inArray(studyCandidates.callStatus, ["needs_call", "no_answer"])))
    .orderBy(asc(studyCandidates.updatedAt));
}

/** Reception's consent tab: patients reached. No evidence. */
export async function getConsentList() {
  const recorder = alias(user, "recorder");
  return db
    .select({
      id: studyCandidates.id,
      patientName: patients.name,
      phone: patients.phone,
      consentStatus: studyCandidates.consentStatus,
      consentByName: recorder.name,
      updatedAt: studyCandidates.updatedAt,
    })
    .from(studyCandidates)
    .innerJoin(patients, eq(patients.id, studyCandidates.patientId))
    .leftJoin(recorder, eq(recorder.id, studyCandidates.consentBy))
    .where(eq(studyCandidates.callStatus, "reached"))
    .orderBy(asc(patients.name));
}
