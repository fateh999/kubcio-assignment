/**
 * Integration test against the local Postgres (docker compose up -d).
 *   bun run test:db
 * Creates its own staff, patient and visits, and removes them afterwards.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { patients, user, visits } from "../src/db/schema";
import { ALREADY_MOVED_ON, transitionVisit } from "../src/lib/transition-visit";
import { VISIT_STAGES } from "../src/lib/visit-stages";

const run = crypto.randomUUID().slice(0, 8);
const nurseA = `t-nurse-a-${run}`;
const nurseB = `t-nurse-b-${run}`;
const patientId = `t-patient-${run}`;
const createdVisits: string[] = [];

async function newVisit(stage: (typeof VISIT_STAGES)[number] = "scheduled") {
  const id = `t-visit-${run}-${createdVisits.length}`;
  createdVisits.push(id);
  await db.insert(visits).values({ id, patientId, reason: "Test", appointmentAt: new Date(), stage });
  return id;
}
const stageOf = async (id: string) => (await db.select({ stage: visits.stage }).from(visits).where(eq(visits.id, id)))[0].stage;

beforeAll(async () => {
  await db.insert(user).values([
    { id: nurseA, name: "Test Nurse A", email: `${nurseA}@test.local`, emailVerified: true, role: "nurse" },
    { id: nurseB, name: "Test Nurse B", email: `${nurseB}@test.local`, emailVerified: true, role: "nurse" },
  ]);
  await db.insert(patients).values({ id: patientId, name: "Test Patient", dob: "1980-01-01", sex: "F", phone: "0", email: "t@example.com" });
});

afterAll(async () => {
  await db.delete(visits).where(inArray(visits.id, createdVisits));
  await db.delete(patients).where(eq(patients.id, patientId));
  await db.delete(user).where(inArray(user.id, [nurseA, nurseB]));
});

describe("transitionVisit (SPEC §7)", () => {
  test("a visit moves through every stage, one step at a time", async () => {
    const id = await newVisit();
    for (let i = 0; i < VISIT_STAGES.length - 1; i++) {
      const r = await transitionVisit(db, { visitId: id, from: VISIT_STAGES[i], to: VISIT_STAGES[i + 1] });
      expect(r).toEqual({ ok: true });
      expect(await stageOf(id)).toBe(VISIT_STAGES[i + 1]);
    }
  });

  test("a stale 'from' changes nothing and reports that the patient moved on (double click)", async () => {
    const id = await newVisit("checked_in");
    expect(await transitionVisit(db, { visitId: id, from: "checked_in", to: "with_nurse" })).toEqual({ ok: true });
    expect(await transitionVisit(db, { visitId: id, from: "checked_in", to: "with_nurse" })).toEqual({ ok: false, error: ALREADY_MOVED_ON });
    expect(await stageOf(id)).toBe("with_nurse");
  });

  test("staff racing for the same patient: exactly one wins, every time (10 rounds × 5 at once)", async () => {
    for (let round = 0; round < 10; round++) {
      const id = await newVisit("checked_in");
      const nurses = [nurseA, nurseB, nurseA, nurseB, nurseA];
      const results = await Promise.all(
        nurses.map((nurseId) => transitionVisit(db, { visitId: id, from: "checked_in", to: "with_nurse", set: { nurseId } })),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === ALREADY_MOVED_ON)).toBe(true);
      const winner = nurses[results.findIndex((r) => r.ok)];
      const [row] = await db.select({ stage: visits.stage, nurseId: visits.nurseId }).from(visits).where(eq(visits.id, id));
      expect(row).toEqual({ stage: "with_nurse", nurseId: winner });
    }
  });

  test("an extra condition (only the assigned nurse) is part of the same update", async () => {
    const id = await newVisit("checked_in");
    await transitionVisit(db, { visitId: id, from: "checked_in", to: "with_nurse", set: { nurseId: nurseA } });

    const byOther = await transitionVisit(db, { visitId: id, from: "with_nurse", to: "ready_for_doctor", where: [eq(visits.nurseId, nurseB)] });
    expect(byOther).toEqual({ ok: false, error: ALREADY_MOVED_ON });
    expect(await stageOf(id)).toBe("with_nurse");

    const byAssigned = await transitionVisit(db, { visitId: id, from: "with_nurse", to: "ready_for_doctor", where: [eq(visits.nurseId, nurseA)] });
    expect(byAssigned).toEqual({ ok: true });
  });

  test("skipping a stage or going back is refused before touching the database", async () => {
    const id = await newVisit("checked_in");
    await expect(transitionVisit(db, { visitId: id, from: "checked_in", to: "ready_for_doctor" })).rejects.toThrow("Invalid visit transition");
    await expect(transitionVisit(db, { visitId: id, from: "checked_in", to: "scheduled" })).rejects.toThrow("Invalid visit transition");
    await expect(transitionVisit(db, { visitId: id, from: "done", to: "done" })).rejects.toThrow("Invalid visit transition");
    expect(await stageOf(id)).toBe("checked_in");
  });

  test("other fields are written in the same statement as the stage", async () => {
    const id = await newVisit("scheduled");
    const arrivedAt = new Date();
    await transitionVisit(db, { visitId: id, from: "scheduled", to: "checked_in", set: { arrivedAt } });
    const [row] = await db.select({ stage: visits.stage, arrivedAt: visits.arrivedAt }).from(visits).where(eq(visits.id, id));
    expect(row.stage).toBe("checked_in");
    expect(row.arrivedAt?.getTime()).toBe(arrivedAt.getTime());
  });
});
