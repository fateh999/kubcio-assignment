/** Visit actions (SPEC §8.1). See src/server/common.ts for how actions are structured. */
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { checkoutTasks, patients, visits } from "@/db/schema";
import { localISODate } from "@/lib/dates";
import { transitionVisit } from "@/lib/transition-visit";
import {
  type ActionResult,
  type Actor,
  type Db,
  NOT_ALLOWED,
  fail,
  idSchema,
  isAllowed,
  ok,
  optionalText,
  parse,
} from "./common";

// ---------- Input ----------

/** Number field from a form: "" / null → null; otherwise a number within [min, max]. */
const measure = (label: string, min: number, max: number, int = false) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
    z
      .number({ error: `${label} must be a number` })
      .refine((n) => Number.isFinite(n), `${label} must be a number`)
      .refine((n) => !int || Number.isInteger(n), `${label} must be a whole number`)
      .refine((n) => n >= min && n <= max, `${label} must be between ${min} and ${max}`)
      .nullable(),
  );

/** Typing-error checks only, not clinical judgments (SPEC §8.1). All optional. */
export const vitalsSchema = z
  .object({
    bpSys: measure("Systolic BP", 50, 260, true),
    bpDia: measure("Diastolic BP", 30, 160, true),
    weightKg: measure("Weight", 0.5, 400),
    tempC: measure("Temperature", 30, 45),
    nurseNote: optionalText(2000, "Note"),
  })
  .partial();

export type VitalsInput = z.input<typeof vitalsSchema>;

/** Only the fields that were sent, in the shapes the columns expect. */
function vitalsToColumns(v: z.output<typeof vitalsSchema>) {
  const cols: Partial<typeof visits.$inferInsert> = {};
  if (v.bpSys !== undefined) cols.bpSys = v.bpSys;
  if (v.bpDia !== undefined) cols.bpDia = v.bpDia;
  if (v.weightKg !== undefined) cols.weightKg = v.weightKg === null ? null : v.weightKg.toFixed(1);
  if (v.tempC !== undefined) cols.tempC = v.tempC === null ? null : v.tempC.toFixed(1);
  if (v.nurseNote !== undefined) cols.nurseNote = v.nurseNote;
  return cols;
}

const doctorNoteSchema = optionalText(5000, "Visit note");
const taskLabelSchema = z.string().trim().min(1, "Task can't be empty").max(200, "Task is too long (max 200 characters)");
const contactSchema = z.object({
  phone: z.string().trim().min(3, "Enter a phone number").max(40, "Phone number is too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(200, "Email is too long")),
});

export const NOT_WITH_YOU = "You can only change this while the patient is with you";

// ---------- Reception ----------

export async function checkIn(db: Db, actor: Actor, visitId: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "checkIn")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const r = await transitionVisit(db, { visitId: id.data, from: "scheduled", to: "checked_in", set: { arrivedAt: new Date() } });
  return r.ok ? ok("Checked in") : fail(r.error);
}

export async function setUrgent(db: Db, actor: Actor, visitId: unknown, urgent: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "setUrgent")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const flag = parse(z.boolean(), urgent);
  if ("error" in flag) return fail(flag.error);
  const updated = await db
    .update(visits)
    .set({ urgent: flag.data })
    .where(and(eq(visits.id, id.data), ne(visits.stage, "done")))
    .returning({ id: visits.id });
  if (updated.length === 0) return fail("This visit is already done");
  return ok(flag.data ? "Marked urgent" : "No longer urgent");
}

/** A patient who arrives without an appointment: new patient record + a visit already checked in. */
export const walkInSchema = z.object({
  name: z.string().trim().min(2, "Enter the patient's name").max(100, "Name is too long"),
  dob: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Date of birth must be a valid date")
    .refine((v) => v == null || v <= localISODate(), "Date of birth can't be in the future"),
  sex: z.enum(["F", "M", "X"], { error: "Choose sex" }),
  phone: z.string().trim().min(3, "Enter a phone number").max(40, "Phone number is too long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email or leave it blank"),
  reason: z.string().trim().min(2, "Enter the reason for the visit").max(300, "Reason is too long"),
  urgent: z.boolean().default(false),
});
export type WalkInInput = z.input<typeof walkInSchema>;

export async function addWalkIn(db: Db, actor: Actor, input: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "addWalkIn")) return fail(NOT_ALLOWED);
  const parsed = parse(walkInSchema, input);
  if ("error" in parsed) return fail(parsed.error);
  const w = parsed.data;
  const now = new Date();
  await db.transaction(async (tx) => {
    const [patient] = await tx
      .insert(patients)
      .values({ name: w.name, dob: w.dob ?? null, sex: w.sex, phone: w.phone, email: w.email })
      .returning({ id: patients.id });
    // Arrives now: appointment and arrival are both "now"; goes straight into the nurse's queue.
    await tx.insert(visits).values({ patientId: patient.id, reason: w.reason, appointmentAt: now, arrivedAt: now, stage: "checked_in", urgent: w.urgent });
  });
  return ok(`${w.name} added and checked in`);
}

export async function updateContact(db: Db, actor: Actor, patientId: unknown, input: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "updateContact")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, patientId);
  if ("error" in id) return fail(id.error);
  const contact = parse(contactSchema, input);
  if ("error" in contact) return fail(contact.error);
  const updated = await db.update(patients).set(contact.data).where(eq(patients.id, id.data)).returning({ id: patients.id });
  return updated.length === 1 ? ok("Contact details updated") : fail("Patient not found");
}

// ---------- Nurse ----------

export async function nurseTake(db: Db, actor: Actor, visitId: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "nurseTake")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const r = await transitionVisit(db, { visitId: id.data, from: "checked_in", to: "with_nurse", set: { nurseId: actor.id } });
  return r.ok ? ok("Patient is with you") : fail(r.error);
}

export async function saveVitals(db: Db, actor: Actor, visitId: unknown, input: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "saveVitals")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const vitals = parse(vitalsSchema, input ?? {});
  if ("error" in vitals) return fail(vitals.error);
  const cols = vitalsToColumns(vitals.data);
  if (Object.keys(cols).length === 0) return ok("Nothing to save");
  const updated = await db
    .update(visits)
    .set(cols)
    .where(and(eq(visits.id, id.data), eq(visits.stage, "with_nurse"), eq(visits.nurseId, actor.id)))
    .returning({ id: visits.id });
  return updated.length === 1 ? ok("Saved") : fail(NOT_WITH_YOU);
}

/** Saves the form (if sent) and moves to ready_for_doctor, in one statement. Only the assigned nurse. */
export async function sendToDoctor(db: Db, actor: Actor, visitId: unknown, input?: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "sendToDoctor")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const vitals = parse(vitalsSchema, input ?? {});
  if ("error" in vitals) return fail(vitals.error);
  const r = await transitionVisit(db, {
    visitId: id.data,
    from: "with_nurse",
    to: "ready_for_doctor",
    set: vitalsToColumns(vitals.data),
    where: [eq(visits.nurseId, actor.id)],
  });
  return r.ok ? ok("Sent to the doctor") : fail(r.error);
}

// ---------- Doctor ----------

/** Any doctor can take any ready-for-doctor patient; the preferred doctor is shown only (SPEC §15). */
export async function doctorTake(db: Db, actor: Actor, visitId: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "doctorTake")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const r = await transitionVisit(db, { visitId: id.data, from: "ready_for_doctor", to: "with_doctor", set: { doctorId: actor.id } });
  return r.ok ? ok("Patient is with you") : fail(r.error);
}

export async function saveDoctorNote(db: Db, actor: Actor, visitId: unknown, note: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "saveDoctorNote")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const text = parse(doctorNoteSchema, note ?? null);
  if ("error" in text) return fail(text.error);
  const updated = await db
    .update(visits)
    .set({ doctorNote: text.data ?? null })
    .where(and(eq(visits.id, id.data), eq(visits.stage, "with_doctor"), eq(visits.doctorId, actor.id)))
    .returning({ id: visits.id });
  return updated.length === 1 ? ok("Saved") : fail(NOT_WITH_YOU);
}

/** Locks the visit row so a task can't be added after another request sends the patient on. */
export async function addCheckoutTask(db: Db, actor: Actor, visitId: unknown, label: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "addCheckoutTask")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const text = parse(taskLabelSchema, label);
  if ("error" in text) return fail(text.error);
  return db.transaction(async (tx) => {
    const [visit] = await tx
      .select({ id: visits.id })
      .from(visits)
      .where(and(eq(visits.id, id.data), eq(visits.stage, "with_doctor"), eq(visits.doctorId, actor.id)))
      .for("update");
    if (!visit) return fail(NOT_WITH_YOU);
    await tx.insert(checkoutTasks).values({ visitId: visit.id, label: text.data });
    return ok("Task added");
  });
}

/** Saves the visit note (if sent) and moves to ready_for_checkout, in one statement. Only the assigned doctor. */
export async function sendToCheckout(db: Db, actor: Actor, visitId: unknown, note?: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "sendToCheckout")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, visitId);
  if ("error" in id) return fail(id.error);
  const text = parse(doctorNoteSchema, note);
  if ("error" in text) return fail(text.error);
  const r = await transitionVisit(db, {
    visitId: id.data,
    from: "with_doctor",
    to: "ready_for_checkout",
    set: text.data === undefined ? {} : { doctorNote: text.data },
    where: [eq(visits.doctorId, actor.id)],
  });
  return r.ok ? ok("Sent to checkout") : fail(r.error);
}
