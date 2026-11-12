/**
 * Server-action logic (SPEC §8.1–§8.4) against the local Postgres.
 *   bun run test:db
 * Creates its own staff, patient, visits, results and study candidates; removes them afterwards.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "../src/db";
import { checkoutTasks, patients, results, studies, studyCandidates, user, visits } from "../src/db/schema";
import { ALREADY_MOVED_ON } from "../src/lib/transition-visit";
import type { VisitStage } from "../src/lib/visit-stages";
import * as checkout from "../src/server/checkout";
import { NOT_ALLOWED, type Actor } from "../src/server/common";
import * as res from "../src/server/results";
import * as study from "../src/server/studies";
import * as visit from "../src/server/visits";

const run = crypto.randomUUID().slice(0, 8);
const actor = (role: Actor["role"], n = "a"): Actor => ({ id: `t-${role}-${n}-${run}`, role });
const reception = actor("receptionist");
const nurseA = actor("nurse", "a");
const nurseB = actor("nurse", "b");
const docA = actor("doctor", "a");
const docB = actor("doctor", "b");
const admin = actor("admin");
const everyone = [reception, nurseA, nurseB, docA, docB, admin];

const patientId = `t-patient-${run}`;
let studyId = "";
let createdStudy = false;
const ids = { visits: [] as string[], results: [] as string[], candidates: [] as string[] };

async function newVisit(stage: VisitStage, extra: Partial<typeof visits.$inferInsert> = {}) {
  const id = `t-visit-${run}-${ids.visits.length}`;
  ids.visits.push(id);
  await db.insert(visits).values({ id, patientId, reason: "Test", appointmentAt: new Date(), stage, ...extra });
  return id;
}
const getVisit = async (id: string) => (await db.select().from(visits).where(eq(visits.id, id)))[0];
const tasksOf = (visitId: string) => db.select().from(checkoutTasks).where(eq(checkoutTasks.visitId, visitId));

async function newCandidate(extra: Partial<typeof studyCandidates.$inferInsert> = {}) {
  // One candidate per (study, patient), so each test candidate gets its own patient.
  const pid = `t-cpatient-${run}-${ids.candidates.length}`;
  await db.insert(patients).values({ id: pid, name: "Candidate", dob: "1970-01-01", sex: "M", phone: "0", email: "c@example.com" });
  const id = `t-cand-${run}-${ids.candidates.length}`;
  ids.candidates.push(id);
  await db.insert(studyCandidates).values({ id, studyId, patientId: pid, matchStatus: "possible_match", evidenceJson: ["x"], missingJson: [], ...extra });
  return id;
}
const getCandidate = async (id: string) => (await db.select().from(studyCandidates).where(eq(studyCandidates.id, id)))[0];

beforeAll(async () => {
  await db.insert(user).values(everyone.map((a) => ({ id: a.id, name: a.id, email: `${a.id}@test.local`, emailVerified: true, role: a.role })));
  await db.insert(patients).values({ id: patientId, name: "Test Patient", dob: "1980-01-01", sex: "F", phone: "0", email: "t@example.com" });
  const [existing] = await db.select().from(studies).where(eq(studies.name, study.DIABETES_STUDY_NAME));
  if (existing) studyId = existing.id;
  else {
    const [s] = await db.insert(studies).values({ name: study.DIABETES_STUDY_NAME, description: "test" }).returning();
    studyId = s.id;
    createdStudy = true;
  }
});

afterAll(async () => {
  await db.delete(checkoutTasks).where(inArray(checkoutTasks.visitId, ids.visits));
  await db.delete(visits).where(inArray(visits.id, ids.visits));
  await db.delete(results).where(inArray(results.id, ids.results));
  const testPatients = (await db.select({ id: patients.id }).from(patients)).map((p) => p.id).filter((id) => id.startsWith("t-") && id.includes(run));
  await db.delete(studyCandidates).where(inArray(studyCandidates.patientId, testPatients));
  await db.delete(patients).where(inArray(patients.id, testPatients));
  // Walk-in patients get generated ids; find them by this run's name.
  const walkIns = await db.select({ id: patients.id }).from(patients).where(like(patients.name, `Walk-in ${run}%`));
  if (walkIns.length) {
    // rerunMatching (below) creates a study row for every patient, walk-ins included.
    await db.delete(studyCandidates).where(inArray(studyCandidates.patientId, walkIns.map((p) => p.id)));
    await db.delete(visits).where(inArray(visits.patientId, walkIns.map((p) => p.id)));
    await db.delete(patients).where(inArray(patients.id, walkIns.map((p) => p.id)));
  }
  if (createdStudy) await db.delete(studies).where(eq(studies.id, studyId));
  await db.delete(user).where(inArray(user.id, everyone.map((a) => a.id)));
});

// ---------------------------------------------------------------------------------------------
describe("§8.1 reception", () => {
  test("checkIn: scheduled → checked_in and records arrival; a second click changes nothing", async () => {
    const id = await newVisit("scheduled");
    const before = Date.now();
    expect(await visit.checkIn(db, reception, id)).toEqual({ ok: "Checked in" });
    const v = await getVisit(id);
    expect(v.stage).toBe("checked_in");
    expect(v.arrivedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await visit.checkIn(db, reception, id)).toEqual({ error: ALREADY_MOVED_ON });
  });

  test("checkIn: only reception", async () => {
    const id = await newVisit("scheduled");
    for (const a of [nurseA, docA, admin]) expect(await visit.checkIn(db, a, id)).toEqual({ error: NOT_ALLOWED });
    expect((await getVisit(id)).stage).toBe("scheduled");
  });

  test("setUrgent: on and off at any stage before done; refused once done", async () => {
    const id = await newVisit("with_nurse");
    expect(await visit.setUrgent(db, reception, id, true)).toEqual({ ok: "Marked urgent" });
    expect((await getVisit(id)).urgent).toBe(true);
    expect(await visit.setUrgent(db, reception, id, false)).toEqual({ ok: "No longer urgent" });
    const doneId = await newVisit("done");
    expect(await visit.setUrgent(db, reception, doneId, true)).toEqual({ error: "This visit is already done" });
    expect(await visit.setUrgent(db, nurseA, id, true)).toEqual({ error: NOT_ALLOWED });
  });

  test("updateContact: validates, normalises the email, reception only", async () => {
    expect(await visit.updateContact(db, reception, patientId, { phone: " +44 7700 900999 ", email: " New@Example.COM " })).toEqual({ ok: "Contact details updated" });
    const [p] = await db.select().from(patients).where(eq(patients.id, patientId));
    expect(p).toMatchObject({ phone: "+44 7700 900999", email: "new@example.com" });
    expect(await visit.updateContact(db, reception, patientId, { phone: "123", email: "not-an-email" })).toEqual({ error: "Enter a valid email" });
    expect(await visit.updateContact(db, docA, patientId, { phone: "123", email: "a@b.co" })).toEqual({ error: NOT_ALLOWED });
    expect(await visit.updateContact(db, reception, "missing", { phone: "123", email: "a@b.co" })).toEqual({ error: "Patient not found" });
  });
});

describe("§8.1 walk-ins", () => {
  const walkIn = (extra: Record<string, unknown> = {}) => ({
    name: `Walk-in ${run} A`,
    dob: "1990-05-01",
    sex: "F",
    phone: "+44 7700 900555",
    email: "",
    reason: "Chest pain",
    urgent: true,
    ...extra,
  });

  test("reception adds a walk-in: new patient + a visit checked in now, in the nurse's queue", async () => {
    const before = Date.now();
    expect(await visit.addWalkIn(db, reception, walkIn())).toEqual({ ok: `Walk-in ${run} A added and checked in` });
    const [row] = await db
      .select({ stage: visits.stage, urgent: visits.urgent, reason: visits.reason, appointmentAt: visits.appointmentAt, arrivedAt: visits.arrivedAt, dob: patients.dob, email: patients.email })
      .from(visits)
      .innerJoin(patients, eq(patients.id, visits.patientId))
      .where(eq(patients.name, `Walk-in ${run} A`));
    expect(row).toMatchObject({ stage: "checked_in", urgent: true, reason: "Chest pain", dob: "1990-05-01", email: "" });
    expect(row.arrivedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.appointmentAt.getTime()).toBe(row.arrivedAt!.getTime());
    // It moves through the normal stages afterwards.
    const [v] = await db.select({ id: visits.id }).from(visits).innerJoin(patients, eq(patients.id, visits.patientId)).where(eq(patients.name, `Walk-in ${run} A`));
    expect(await visit.nurseTake(db, nurseA, v.id)).toEqual({ ok: "Patient is with you" });
  });

  test("date of birth and email are optional; input is checked", async () => {
    expect(await visit.addWalkIn(db, reception, walkIn({ name: `Walk-in ${run} B`, dob: "", urgent: false }))).toMatchObject({ ok: expect.any(String) });
    expect(await visit.addWalkIn(db, reception, walkIn({ name: "" }))).toEqual({ error: "Enter the patient's name" });
    expect(await visit.addWalkIn(db, reception, walkIn({ reason: " " }))).toEqual({ error: "Enter the reason for the visit" });
    expect(await visit.addWalkIn(db, reception, walkIn({ sex: "" }))).toEqual({ error: "Choose sex" });
    expect(await visit.addWalkIn(db, reception, walkIn({ email: "nope" }))).toEqual({ error: "Enter a valid email or leave it blank" });
    expect(await visit.addWalkIn(db, reception, walkIn({ dob: "2999-01-01" }))).toEqual({ error: "Date of birth can't be in the future" });
    expect(await visit.addWalkIn(db, reception, walkIn({ dob: "01/05/1990" }))).toEqual({ error: "Date of birth must be a valid date" });
  });

  test("only reception can add walk-ins", async () => {
    for (const a of [nurseA, docA, admin]) expect(await visit.addWalkIn(db, a, walkIn({ name: `Walk-in ${run} X` }))).toEqual({ error: NOT_ALLOWED });
    expect(await db.select().from(patients).where(eq(patients.name, `Walk-in ${run} X`))).toHaveLength(0);
  });
});

describe("§8.1 nurse", () => {
  test("nurseTake records the nurse; another nurse then gets 'already moved on'", async () => {
    const id = await newVisit("checked_in");
    expect(await visit.nurseTake(db, nurseA, id)).toEqual({ ok: "Patient is with you" });
    expect(await visit.nurseTake(db, nurseB, id)).toEqual({ error: ALREADY_MOVED_ON });
    expect(await getVisit(id)).toMatchObject({ stage: "with_nurse", nurseId: nurseA.id });
  });

  test("saveVitals: form strings are parsed; blanks clear; only the assigned nurse", async () => {
    const id = await newVisit("checked_in");
    await visit.nurseTake(db, nurseA, id);
    expect(await visit.saveVitals(db, nurseA, id, { bpSys: "128", bpDia: "82", weightKg: "71.25", tempC: "36.8", nurseNote: "  ok  " })).toEqual({ ok: "Saved" });
    expect(await getVisit(id)).toMatchObject({ bpSys: 128, bpDia: 82, weightKg: "71.3", tempC: "36.8", nurseNote: "ok" });

    expect(await visit.saveVitals(db, nurseA, id, { tempC: "", nurseNote: "" })).toEqual({ ok: "Saved" });
    expect(await getVisit(id)).toMatchObject({ bpSys: 128, tempC: null, nurseNote: null });

    expect(await visit.saveVitals(db, nurseB, id, { bpSys: "120" })).toEqual({ error: visit.NOT_WITH_YOU });
    expect((await getVisit(id)).bpSys).toBe(128);
  });

  test("saveVitals: typing errors are caught", async () => {
    const id = await newVisit("with_nurse", { nurseId: nurseA.id });
    expect(await visit.saveVitals(db, nurseA, id, { bpSys: "1280" })).toEqual({ error: "Systolic BP must be between 50 and 260" });
    expect(await visit.saveVitals(db, nurseA, id, { bpDia: "80.5" })).toEqual({ error: "Diastolic BP must be a whole number" });
    expect(await visit.saveVitals(db, nurseA, id, { tempC: "hot" })).toEqual({ error: "Temperature must be a number" });
    expect(await visit.saveVitals(db, nurseA, id, { weightKg: "0" })).toEqual({ error: "Weight must be between 0.5 and 400" });
    expect(await visit.saveVitals(db, nurseA, id, { nurseNote: "x".repeat(2001) })).toEqual({ error: "Note is too long (max 2000 characters)" });
  });

  test("sendToDoctor saves the form and moves on in one go; only the assigned nurse", async () => {
    const id = await newVisit("checked_in");
    await visit.nurseTake(db, nurseA, id);
    expect(await visit.sendToDoctor(db, nurseB, id, { bpSys: "120" })).toEqual({ error: ALREADY_MOVED_ON });
    expect(await visit.sendToDoctor(db, nurseA, id, { bpSys: "999" })).toEqual({ error: "Systolic BP must be between 50 and 260" });
    expect((await getVisit(id)).stage).toBe("with_nurse");
    expect(await visit.sendToDoctor(db, nurseA, id, { bpSys: "120", bpDia: "80", nurseNote: "Cough" })).toEqual({ ok: "Sent to the doctor" });
    expect(await getVisit(id)).toMatchObject({ stage: "ready_for_doctor", bpSys: 120, bpDia: 80, nurseNote: "Cough", nurseId: nurseA.id });
  });

  test("nurse actions are nurse-only", async () => {
    const id = await newVisit("checked_in");
    for (const a of [reception, docA, admin]) expect(await visit.nurseTake(db, a, id)).toEqual({ error: NOT_ALLOWED });
  });
});

describe("§8.1 doctor", () => {
  test("any doctor can take a ready-for-doctor patient (preferred doctor not enforced)", async () => {
    const id = await newVisit("ready_for_doctor", { preferredDoctor: docA.id });
    expect(await visit.doctorTake(db, docB, id)).toEqual({ ok: "Patient is with you" });
    expect(await visit.doctorTake(db, docA, id)).toEqual({ error: ALREADY_MOVED_ON });
    expect(await getVisit(id)).toMatchObject({ stage: "with_doctor", doctorId: docB.id });
  });

  test("note and checkout tasks: only the assigned doctor, only while with_doctor", async () => {
    const id = await newVisit("ready_for_doctor");
    await visit.doctorTake(db, docA, id);
    expect(await visit.saveDoctorNote(db, docA, id, "Plan: review in 3 months")).toEqual({ ok: "Saved" });
    expect(await visit.saveDoctorNote(db, docB, id, "hijack")).toEqual({ error: visit.NOT_WITH_YOU });
    expect(await visit.addCheckoutTask(db, docA, id, "  Book follow-up in 3 months ")).toEqual({ ok: "Task added" });
    expect(await visit.addCheckoutTask(db, docB, id, "Other")).toEqual({ error: visit.NOT_WITH_YOU });
    expect(await visit.addCheckoutTask(db, docA, id, "   ")).toEqual({ error: "Task can't be empty" });
    expect((await tasksOf(id)).map((t) => [t.label, t.done])).toEqual([["Book follow-up in 3 months", false]]);
    expect((await getVisit(id)).doctorNote).toBe("Plan: review in 3 months");
  });

  test("sendToCheckout saves the note; afterwards no more tasks or note edits", async () => {
    const id = await newVisit("ready_for_doctor");
    await visit.doctorTake(db, docA, id);
    expect(await visit.sendToCheckout(db, docB, id, "x")).toEqual({ error: ALREADY_MOVED_ON });
    expect(await visit.sendToCheckout(db, docA, id, "Final note")).toEqual({ ok: "Sent to checkout" });
    expect(await getVisit(id)).toMatchObject({ stage: "ready_for_checkout", doctorNote: "Final note" });
    expect(await visit.addCheckoutTask(db, docA, id, "Late task")).toEqual({ error: visit.NOT_WITH_YOU });
    expect(await visit.saveDoctorNote(db, docA, id, "Edit")).toEqual({ error: visit.NOT_WITH_YOU });
  });

  test("sendToCheckout without a note leaves the saved note alone", async () => {
    const id = await newVisit("with_doctor", { doctorId: docA.id, doctorNote: "Kept" });
    expect(await visit.sendToCheckout(db, docA, id)).toEqual({ ok: "Sent to checkout" });
    expect((await getVisit(id)).doctorNote).toBe("Kept");
  });

  test("a task can't be added once a concurrent send-to-checkout wins (row lock)", async () => {
    for (let round = 0; round < 10; round++) {
      const id = await newVisit("with_doctor", { doctorId: docA.id });
      const [added, sent] = await Promise.all([visit.addCheckoutTask(db, docA, id, "Race"), visit.sendToCheckout(db, docA, id)]);
      expect(sent).toEqual({ ok: "Sent to checkout" });
      const tasks = await tasksOf(id);
      // Either the task went in before the send, or it was refused. Never added after.
      expect("ok" in added ? tasks.length === 1 : tasks.length === 0).toBe(true);
    }
  });

  test("doctor actions are doctor-only", async () => {
    const id = await newVisit("ready_for_doctor");
    for (const a of [reception, nurseA, admin]) expect(await visit.doctorTake(db, a, id)).toEqual({ error: NOT_ALLOWED });
  });
});

// ---------------------------------------------------------------------------------------------
describe("§8.2 results", () => {
  test("markReviewed records who and when, once; doctor only", async () => {
    const id = `t-result-${run}`;
    ids.results.push(id);
    await db.insert(results).values({ id, patientId, test: "HbA1c", value: "7.0", unit: "%", resultedAt: new Date() });
    expect(await res.markReviewed(db, nurseA, id)).toEqual({ error: NOT_ALLOWED });
    expect(await res.markReviewed(db, reception, id)).toEqual({ error: NOT_ALLOWED });
    expect(await res.markReviewed(db, docA, id)).toEqual({ ok: "Marked reviewed" });
    const [r] = await db.select().from(results).where(eq(results.id, id));
    expect(r.reviewedBy).toBe(docA.id);
    expect(r.reviewedAt).toBeInstanceOf(Date);
    expect(await res.markReviewed(db, docB, id)).toEqual({ error: "This result was already reviewed" });
    expect((await db.select().from(results).where(eq(results.id, id)))[0].reviewedBy).toBe(docA.id);
  });
});

// ---------------------------------------------------------------------------------------------
describe("§8.3 checkout", () => {
  test("can't complete with an open task; can once it's ticked; only once", async () => {
    const id = await newVisit("ready_for_checkout");
    const [t1] = await db.insert(checkoutTasks).values({ visitId: id, label: "Book follow-up" }).returning();
    await db.insert(checkoutTasks).values({ visitId: id, label: "Leaflet", done: true });

    expect(await checkout.completeVisit(db, reception, id)).toEqual({ error: "1 task is still open" });
    expect((await getVisit(id)).stage).toBe("ready_for_checkout");

    expect(await checkout.toggleTask(db, reception, t1.id, true)).toEqual({ ok: "Task done" });
    expect(await checkout.completeVisit(db, reception, id)).toEqual({ ok: "Visit complete" });
    expect((await getVisit(id)).stage).toBe("done");
    expect(await checkout.completeVisit(db, reception, id)).toEqual({ error: ALREADY_MOVED_ON });
  });

  test("a visit with no tasks completes; plural message for several open", async () => {
    expect(await checkout.completeVisit(db, reception, await newVisit("ready_for_checkout"))).toEqual({ ok: "Visit complete" });
    const id = await newVisit("ready_for_checkout");
    await db.insert(checkoutTasks).values([{ visitId: id, label: "a" }, { visitId: id, label: "b" }]);
    expect(await checkout.completeVisit(db, reception, id)).toEqual({ error: "2 tasks are still open" });
  });

  test("complete is reception only; only from ready_for_checkout", async () => {
    const id = await newVisit("ready_for_checkout");
    for (const a of [docA, nurseA, admin]) expect(await checkout.completeVisit(db, a, id)).toEqual({ error: NOT_ALLOWED });
    expect(await checkout.completeVisit(db, reception, await newVisit("with_doctor"))).toEqual({ error: ALREADY_MOVED_ON });
  });

  test("toggleTask: reception and doctor; not nurse or admin; not once the visit is done", async () => {
    const id = await newVisit("with_doctor", { doctorId: docA.id });
    const [t] = await db.insert(checkoutTasks).values({ visitId: id, label: "x" }).returning();
    expect(await checkout.toggleTask(db, docA, t.id, true)).toEqual({ ok: "Task done" });
    expect(await checkout.toggleTask(db, reception, t.id, false)).toEqual({ ok: "Task reopened" });
    expect(await checkout.toggleTask(db, nurseA, t.id, true)).toEqual({ error: NOT_ALLOWED });
    expect(await checkout.toggleTask(db, admin, t.id, true)).toEqual({ error: NOT_ALLOWED });
    await db.update(visits).set({ stage: "done" }).where(eq(visits.id, id));
    expect(await checkout.toggleTask(db, reception, t.id, true)).toEqual({ error: "This task can't be changed now" });
    expect(await checkout.toggleTask(db, reception, "missing", true)).toEqual({ error: "Task not found" });
  });

  test("untick racing 'Complete visit': never a done visit with an open task (30 rounds)", async () => {
    for (let round = 0; round < 30; round++) {
      const id = await newVisit("ready_for_checkout");
      const [t] = await db.insert(checkoutTasks).values({ visitId: id, label: "x", done: true }).returning();
      await Promise.all([checkout.toggleTask(db, reception, t.id, false), checkout.completeVisit(db, reception, id)]);
      const v = await getVisit(id);
      const open = (await tasksOf(id)).filter((x) => !x.done).length;
      expect(v.stage === "done" && open > 0).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("§8.4 studies: review, call and consent stay independent", () => {
  test("approve: approved + needs_call; consent stays unknown; note and reviewer recorded; once only", async () => {
    const id = await newCandidate();
    expect(await study.approveCandidate(db, docA, id, " Good fit ")).toEqual({ ok: "Approved for contact. Added to the call list" });
    expect(await getCandidate(id)).toMatchObject({ reviewStatus: "approved", reviewedBy: docA.id, callStatus: "needs_call", consentStatus: "unknown", consentBy: null, notes: "Good fit" });
    expect(await study.approveCandidate(db, docB, id)).toEqual({ error: "This candidate was already reviewed" });
    expect(await study.dismissCandidate(db, docB, id)).toEqual({ error: "This candidate was already reviewed" });
  });

  test("approve never moves a call that already started", async () => {
    const id = await newCandidate({ callStatus: "reached" });
    await study.approveCandidate(db, docA, id);
    expect((await getCandidate(id)).callStatus).toBe("reached");
  });

  test("dismiss: dismissed; call and consent untouched", async () => {
    const id = await newCandidate();
    expect(await study.dismissCandidate(db, docA, id, "Not suitable")).toEqual({ ok: "Dismissed" });
    expect(await getCandidate(id)).toMatchObject({ reviewStatus: "dismissed", callStatus: "not_started", consentStatus: "unknown", notes: "Not suitable" });
    expect(await study.logCall(db, reception, id, "reached")).toEqual({ error: "This patient isn't on the call list" });
  });

  test("no_match candidates (not listed) can't be reviewed", async () => {
    const id = await newCandidate({ matchStatus: "no_match" });
    expect(await study.approveCandidate(db, docA, id)).toEqual({ error: "This candidate was already reviewed" });
    expect((await getCandidate(id)).reviewStatus).toBe("pending");
  });

  test("call list: only after approval; no answer can be retried; reached leaves consent unknown", async () => {
    const id = await newCandidate();
    expect(await study.logCall(db, reception, id, "reached")).toEqual({ error: "This patient isn't on the call list" });
    await study.approveCandidate(db, docA, id);
    expect(await study.logCall(db, reception, id, "no_answer")).toEqual({ ok: "Logged: no answer" });
    expect(await study.logCall(db, reception, id, "reached")).toEqual({ ok: "Logged: reached. Record consent next" });
    expect(await getCandidate(id)).toMatchObject({ callStatus: "reached", consentStatus: "unknown", consentBy: null });
    expect(await study.logCall(db, reception, id, "no_answer")).toEqual({ error: "This patient isn't on the call list" });
    expect(await study.logCall(db, reception, id, "maybe")).toEqual({ error: "Choose reached or no answer" });
  });

  test("consent: only after reached, only once, records who; nothing else sets it", async () => {
    const id = await newCandidate();
    expect(await study.recordConsent(db, reception, id, "consented")).toEqual({ error: "Consent can only be recorded once, after the patient has been reached" });
    await study.approveCandidate(db, docA, id);
    expect(await study.recordConsent(db, reception, id, "consented")).toMatchObject({ error: expect.any(String) });
    await study.logCall(db, reception, id, "no_answer");
    expect(await study.recordConsent(db, reception, id, "consented")).toMatchObject({ error: expect.any(String) });
    expect((await getCandidate(id)).consentStatus).toBe("unknown");

    await study.logCall(db, reception, id, "reached");
    expect(await study.recordConsent(db, reception, id, "consented")).toEqual({ ok: "Recorded: consented" });
    expect(await getCandidate(id)).toMatchObject({ consentStatus: "consented", consentBy: reception.id, reviewStatus: "approved", callStatus: "reached" });
    expect(await study.recordConsent(db, reception, id, "declined")).toMatchObject({ error: expect.any(String) });
    expect((await getCandidate(id)).consentStatus).toBe("consented");
  });

  test("roles: doctor reviews and re-runs; reception calls and records consent", async () => {
    const id = await newCandidate();
    for (const a of [reception, nurseA, admin]) {
      expect(await study.approveCandidate(db, a, id)).toEqual({ error: NOT_ALLOWED });
      expect(await study.dismissCandidate(db, a, id)).toEqual({ error: NOT_ALLOWED });
      expect(await study.rerunMatching(db, a)).toEqual({ error: NOT_ALLOWED });
    }
    await study.approveCandidate(db, docA, id);
    for (const a of [docA, nurseA, admin]) {
      expect(await study.logCall(db, a, id, "reached")).toEqual({ error: NOT_ALLOWED });
      expect(await study.recordConsent(db, a, id, "consented")).toEqual({ error: NOT_ALLOWED });
    }
    expect(await getCandidate(id)).toMatchObject({ callStatus: "needs_call", consentStatus: "unknown" });
  });

  test("rerunMatching updates match fields only; review, call, consent and notes survive", async () => {
    // A candidate row with stale match fields and every tracking field filled in.
    const [row] = await db
      .insert(studyCandidates)
      .values({ studyId, patientId, matchStatus: "possible_match", evidenceJson: ["stale"], missingJson: [], reviewStatus: "approved", reviewedBy: docA.id, callStatus: "reached", consentStatus: "consented", consentBy: reception.id, notes: "keep" })
      .returning();
    const r = await study.rerunMatching(db, docA);
    expect("ok" in r && r.ok.startsWith("Matched ")).toBe(true);
    const after = await getCandidate(row.id);
    expect(after.evidenceJson).not.toEqual(["stale"]); // match fields were recomputed
    expect(after.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    expect(after).toMatchObject({ reviewStatus: "approved", reviewedBy: docA.id, callStatus: "reached", consentStatus: "consented", consentBy: reception.id, notes: "keep" });
  });
});
