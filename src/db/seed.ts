/**
 * Seed (SPEC §11). Resets the clinic and auth tables, then inserts synthetic data.
 * All dates are relative to when the seed runs, so "today" always has visits.
 *
 *   bun run seed
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  allergies,
  checkoutTasks,
  conditions,
  medications,
  patients,
  results,
  studies,
  studyCandidates,
  user,
  visits,
} from "@/db/schema";
import { localISODate } from "@/lib/dates";
import { runMatching } from "@/lib/run-matching";
import type { Role } from "@/lib/roles";

const now = new Date();
const today = localISODate(now);
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 60 * 1000);

/** Date of birth `years` (and `days`) before today. */
function dobYearsAgo(years: number, days = 0): string {
  const d = new Date(startOfToday);
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - days);
  return localISODate(d);
}
const daysAgoDate = (days: number) => localISODate(new Date(startOfToday.getTime() - days * 86_400_000));
const daysAgo = (days: number, hour = 9) => {
  const d = new Date(startOfToday.getTime() - days * 86_400_000);
  d.setHours(hour);
  return d;
};
/** A time today, `mins` from now, kept inside today so the board always shows it. */
const todayAt = (mins: number) =>
  new Date(Math.min(endOfToday.getTime(), Math.max(startOfToday.getTime() + 60_000, now.getTime() + mins * 60_000)));

// ---------- Staff ----------

const STAFF: { key: string; name: string; email: string; role: Role }[] = [
  { key: "admin", name: "Clinic Owner", email: "admin@clinic.test", role: "admin" },
  { key: "rosa", name: "Rosa Mendes", email: "reception@clinic.test", role: "receptionist" },
  { key: "priya", name: "Priya Shah", email: "priya@clinic.test", role: "nurse" },
  { key: "tom", name: "Tom Okafor", email: "tom@clinic.test", role: "nurse" },
  { key: "khan", name: "Dr Aisha Khan", email: "khan@clinic.test", role: "doctor" },
  { key: "nowak", name: "Dr Marek Nowak", email: "nowak@clinic.test", role: "doctor" },
];

// ---------- Patients ----------

type Cond = { name: string; code: string | null; recordedAt: string };
type SeedPatient = {
  key: string;
  name: string;
  dob: string | null;
  sex: "F" | "M";
  conditions?: Cond[];
  meds?: { name: string; active: boolean }[];
  allergies?: string[];
  /** Expected match status, printed as a spot-check after matching. */
  expect?: "possible_match" | "needs_check" | "no_match";
};

const t2 = (recordedDaysAgo: number): Cond => ({ name: "Type 2 diabetes", code: "E11.9", recordedAt: daysAgoDate(recordedDaysAgo) });
const t1 = (recordedDaysAgo: number): Cond => ({ name: "Type 1 diabetes", code: "E10.9", recordedAt: daysAgoDate(recordedDaysAgo) });
const cond = (name: string, code: string, recordedDaysAgo: number): Cond => ({ name, code, recordedAt: daysAgoDate(recordedDaysAgo) });

const PATIENTS: SeedPatient[] = [
  // --- The six PRD edge cases ---
  { key: "edge_t2_adult", name: "Margaret Ellis", dob: dobYearsAgo(54, 40), sex: "F", conditions: [t2(1300)], meds: [{ name: "Metformin 500 mg", active: true }], expect: "possible_match" },
  { key: "edge_metformin_no_dx", name: "Gareth Price", dob: dobYearsAgo(61, 100), sex: "M", conditions: [cond("Hypertension", "I10", 2000)], meds: [{ name: "Metformin 850 mg", active: true }, { name: "Amlodipine 5 mg", active: true }], expect: "needs_check" },
  { key: "edge_dx_no_dob", name: "Sunita Rao", dob: null, sex: "F", conditions: [t2(700)], expect: "needs_check" },
  { key: "edge_17_t1", name: "Leo Hartmann", dob: dobYearsAgo(17, 30), sex: "M", conditions: [t1(900)], meds: [{ name: "Insulin aspart", active: true }], expect: "no_match" },
  { key: "edge_adult_none", name: "Clara Novak", dob: dobYearsAgo(40, 12), sex: "F", conditions: [cond("Hypertension", "I10", 500)], expect: "no_match" },
  { key: "edge_turning_18", name: "Noah Fischer", dob: dobYearsAgo(18), sex: "M", conditions: [t1(1500)], meds: [{ name: "Insulin glargine", active: true }], expect: "possible_match" },

  // --- More study-relevant records ---
  { key: "dm_code_only", name: "Henryk Zielinski", dob: dobYearsAgo(67, 3), sex: "M", conditions: [{ name: "DM with hyperglycaemia", code: "E11.65", recordedAt: daysAgoDate(400) }], expect: "possible_match" },
  { key: "hba1c_only", name: "Fatima Begum", dob: dobYearsAgo(49, 200), sex: "F", expect: "needs_check" },
  { key: "t1_adult", name: "Oliver Grant", dob: dobYearsAgo(33, 60), sex: "M", conditions: [t1(3000)], meds: [{ name: "Insulin glargine", active: true }], allergies: ["Penicillin"], expect: "possible_match" },
  { key: "old_metformin", name: "Beatrice Okoye", dob: dobYearsAgo(58, 9), sex: "F", meds: [{ name: "Metformin 500 mg", active: false }], expect: "needs_check" },

  // --- Ordinary records ---
  { key: "p11", name: "James Whitfield", dob: dobYearsAgo(45, 77), sex: "M", conditions: [cond("Asthma", "J45.9", 4000)], meds: [{ name: "Salbutamol inhaler", active: true }] },
  { key: "p12", name: "Amira Haddad", dob: dobYearsAgo(29, 150), sex: "F", allergies: ["Latex"] },
  { key: "p13", name: "Tomasz Wrona", dob: dobYearsAgo(72, 20), sex: "M", conditions: [cond("Atrial fibrillation", "I48.91", 900), cond("Hypertension", "I10", 2500)], meds: [{ name: "Apixaban 5 mg", active: true }], allergies: ["Aspirin"] },
  { key: "p14", name: "Grace Mensah", dob: dobYearsAgo(36, 210), sex: "F", conditions: [cond("Hypothyroidism", "E03.9", 1200)], meds: [{ name: "Levothyroxine 75 mcg", active: true }] },
  { key: "p15", name: "Daniel Kowalczyk", dob: dobYearsAgo(52, 5), sex: "M", conditions: [cond("Hyperlipidaemia", "E78.5", 600)], meds: [{ name: "Atorvastatin 20 mg", active: true }] },
  { key: "p16", name: "Hannah Lindqvist", dob: dobYearsAgo(24, 300), sex: "F" },
  { key: "p17", name: "Samuel Adeyemi", dob: dobYearsAgo(8, 40), sex: "M", conditions: [cond("Eczema", "L30.9", 1000)], allergies: ["Peanut"] },
  { key: "p18", name: "Isabel Moreno", dob: dobYearsAgo(63, 111), sex: "F", conditions: [cond("Osteoarthritis of knee", "M17.9", 1800)], meds: [{ name: "Paracetamol 1 g", active: true }] },
  { key: "p19", name: "Victor Lambert", dob: dobYearsAgo(41, 18), sex: "M", conditions: [cond("Depression", "F32.9", 700)], meds: [{ name: "Sertraline 50 mg", active: true }] },
  { key: "p20", name: "Mei Lin", dob: dobYearsAgo(31, 222), sex: "F", allergies: ["Sulfonamides"] },
  { key: "p21", name: "Patrick Doyle", dob: dobYearsAgo(78, 61), sex: "M", conditions: [cond("COPD", "J44.9", 2200), cond("Hypertension", "I10", 3000)], meds: [{ name: "Tiotropium inhaler", active: true }] },
  { key: "p22", name: "Zofia Mazur", dob: dobYearsAgo(55, 140), sex: "F", conditions: [cond("Migraine", "G43.909", 3500)] },
  { key: "p23", name: "Ethan Brooks", dob: dobYearsAgo(19, 25), sex: "M" },
  { key: "p24", name: "Layla Rahman", dob: dobYearsAgo(14, 190), sex: "F", conditions: [cond("Asthma", "J45.9", 1500)], meds: [{ name: "Beclometasone inhaler", active: true }] },
  { key: "p25", name: "Robert Hughes", dob: dobYearsAgo(68, 310), sex: "M", conditions: [cond("Gout", "M10.9", 800)], meds: [{ name: "Allopurinol 100 mg", active: true }] },
  { key: "p26", name: "Elena Popescu", dob: dobYearsAgo(47, 33), sex: "F", conditions: [cond("Iron deficiency anaemia", "D50.9", 120)], meds: [{ name: "Ferrous sulfate 200 mg", active: true }] },
  { key: "p27", name: "Kwame Asante", dob: dobYearsAgo(38, 255), sex: "M", allergies: ["Ibuprofen"] },
  { key: "p28", name: "Sofia Romano", dob: dobYearsAgo(26, 95), sex: "F" },
  { key: "p29", name: "Arthur Bennett", dob: dobYearsAgo(83, 12), sex: "M", conditions: [cond("Heart failure", "I50.9", 1100)], meds: [{ name: "Furosemide 40 mg", active: true }, { name: "Bisoprolol 2.5 mg", active: true }] },
  { key: "p30", name: "Nadia Petrova", dob: dobYearsAgo(59, 177), sex: "F", conditions: [cond("Hypertension", "I10", 1600)], meds: [{ name: "Ramipril 5 mg", active: true }], allergies: ["Codeine"] },
];

async function main() {
  console.log(`Seeding for ${today}…`);

  await db.execute(sql`
    TRUNCATE TABLE study_candidates, studies, checkout_tasks, visits, results, allergies, medications,
      conditions, patients, verification, session, account, "user" RESTART IDENTITY CASCADE
  `);

  // Staff: inserted directly with a role; they sign in with a magic link.
  const staff = Object.fromEntries(STAFF.map((s) => [s.key, crypto.randomUUID()])) as Record<string, string>;
  await db.insert(user).values(
    STAFF.map((s) => ({ id: staff[s.key], name: s.name, email: s.email, emailVerified: true, role: s.role, banned: false })),
  );

  // Patients + record.
  const pid = Object.fromEntries(PATIENTS.map((p) => [p.key, crypto.randomUUID()])) as Record<string, string>;
  await db.insert(patients).values(
    PATIENTS.map((p, i) => ({
      id: pid[p.key],
      name: p.name,
      dob: p.dob,
      sex: p.sex,
      phone: `+44 7700 900${String(100 + i).padStart(3, "0")}`,
      email: `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    })),
  );
  await db.insert(conditions).values(PATIENTS.flatMap((p) => (p.conditions ?? []).map((c) => ({ patientId: pid[p.key], ...c }))));
  await db.insert(medications).values(PATIENTS.flatMap((p) => (p.meds ?? []).map((m) => ({ patientId: pid[p.key], ...m }))));
  await db.insert(allergies).values(PATIENTS.flatMap((p) => (p.allergies ?? []).map((substance) => ({ patientId: pid[p.key], substance }))));

  // Results: 8 unreviewed over the last 1–14 days, plus reviewed history.
  const unreviewed = [
    { p: "edge_t2_adult", test: "HbA1c", value: "7.8", unit: "%", days: 14 },
    { p: "hba1c_only", test: "HbA1c", value: "6.9", unit: "%", days: 11 },
    { p: "p13", test: "INR", value: "2.4", unit: null, days: 9 },
    { p: "p26", test: "Ferritin", value: "9", unit: "µg/L", days: 7 },
    { p: "p15", test: "Total cholesterol", value: "6.1", unit: "mmol/L", days: 5 },
    { p: "p29", test: "eGFR", value: "48", unit: "mL/min/1.73m²", days: 3 },
    { p: "p14", test: "TSH", value: "5.2", unit: "mU/L", days: 2 },
    { p: "t1_adult", test: "HbA1c", value: "8.4", unit: "%", days: 1 },
  ];
  const reviewed = [
    { p: "edge_t2_adult", test: "HbA1c", value: "8.1", unit: "%", days: 120 },
    { p: "p21", test: "Full blood count", value: "Normal", unit: null, days: 60 },
    { p: "p30", test: "Potassium", value: "4.3", unit: "mmol/L", days: 30 },
    { p: "dm_code_only", test: "HbA1c", value: "7.2", unit: "%", days: 45 },
  ];
  await db.insert(results).values([
    ...unreviewed.map((r) => ({ patientId: pid[r.p], test: r.test, value: r.value, unit: r.unit, resultedAt: daysAgo(r.days, 10) })),
    ...reviewed.map((r) => ({
      patientId: pid[r.p],
      test: r.test,
      value: r.value,
      unit: r.unit,
      resultedAt: daysAgo(r.days, 10),
      reviewedAt: daysAgo(r.days - 1, 15),
      reviewedBy: staff.khan,
    })),
  ]);

  // Visits today: every stage, 2 urgent.
  const vitals = (bpSys: number, bpDia: number, weightKg: string, tempC: string, nurseNote: string) => ({ bpSys, bpDia, weightKg, tempC, nurseNote });
  const visitRows = [
    // scheduled
    { key: "v1", p: "p16", reason: "Contraception review", appointmentAt: todayAt(30), stage: "scheduled" as const, preferredDoctor: staff.nowak },
    { key: "v2", p: "p25", reason: "Gout flare follow-up", appointmentAt: todayAt(60), stage: "scheduled" as const },
    { key: "v3", p: "edge_dx_no_dob", reason: "Annual diabetes review", appointmentAt: todayAt(90), stage: "scheduled" as const, preferredDoctor: staff.khan },
    // checked in: the urgent one arrived later but sorts first
    { key: "v4", p: "p22", reason: "Recurring headaches", appointmentAt: todayAt(-30), arrivedAt: todayAt(-25), stage: "checked_in" as const },
    { key: "v5", p: "p17", reason: "Wheeze and rash after eating", appointmentAt: todayAt(-15), arrivedAt: todayAt(-10), stage: "checked_in" as const, urgent: true },
    // with nurse
    { key: "v6", p: "p19", reason: "Medication review", appointmentAt: todayAt(-50), arrivedAt: todayAt(-40), stage: "with_nurse" as const, nurseId: staff.priya },
    // ready for doctor
    { key: "v7", p: "p21", reason: "Shortness of breath, worse this week", appointmentAt: todayAt(-75), arrivedAt: todayAt(-70), stage: "ready_for_doctor" as const, urgent: true, nurseId: staff.tom, preferredDoctor: staff.nowak, ...vitals(148, 88, "81.2", "37.9", "SpO2 93% on air. Productive cough, using inhaler more often.") },
    { key: "v8", p: "p18", reason: "Knee pain", appointmentAt: todayAt(-60), arrivedAt: todayAt(-55), stage: "ready_for_doctor" as const, nurseId: staff.priya, ...vitals(132, 80, "74.0", "36.7", "Pain 6/10 on stairs. No swelling today.") },
    // with doctor
    { key: "v9", p: "edge_t2_adult", reason: "Diabetes check and HbA1c results", appointmentAt: todayAt(-100), arrivedAt: todayAt(-95), stage: "with_doctor" as const, nurseId: staff.tom, doctorId: staff.khan, preferredDoctor: staff.khan, ...vitals(138, 84, "88.5", "36.6", "Feet checked, no ulcers. Reports good adherence.") },
    // ready for checkout: one with an open task, one with none
    { key: "v10", p: "p13", reason: "INR check", appointmentAt: todayAt(-130), arrivedAt: todayAt(-125), stage: "ready_for_checkout" as const, nurseId: staff.priya, doctorId: staff.nowak, ...vitals(126, 78, "79.3", "36.5", "No bleeding or bruising reported."), doctorNote: "INR in range. Continue current dose." },
    { key: "v11", p: "p28", reason: "Sore throat", appointmentAt: todayAt(-120), arrivedAt: todayAt(-118), stage: "ready_for_checkout" as const, nurseId: staff.tom, doctorId: staff.khan, ...vitals(118, 72, "61.0", "37.4", "Tonsils red, no exudate."), doctorNote: "Viral pharyngitis. Self-care advice given." },
    // done
    { key: "v12", p: "p12", reason: "Travel vaccination advice", appointmentAt: todayAt(-180), arrivedAt: todayAt(-178), stage: "done" as const, nurseId: staff.priya, doctorId: staff.nowak, ...vitals(112, 70, "58.4", "36.4", "Vaccination history reviewed."), doctorNote: "Advice given; no vaccines due." },
  ];
  const vid = Object.fromEntries(visitRows.map((v) => [v.key, crypto.randomUUID()])) as Record<string, string>;
  await db.insert(visits).values(
    visitRows.map(({ key, p, ...v }) => ({ id: vid[key], patientId: pid[p], ...v })),
  );
  await db.insert(checkoutTasks).values([
    { visitId: vid.v10, label: "Book INR check in 4 weeks", done: false },
    { visitId: vid.v10, label: "Print dosing schedule", done: true },
    { visitId: vid.v12, label: "Give travel health leaflet", done: true },
    { visitId: vid.v9, label: "Book follow-up in 3 months", done: false },
  ]);

  // Study + matching.
  const [study] = await db
    .insert(studies)
    .values({ name: "Diabetes study", description: "Adults with a documented diabetes diagnosis." })
    .returning();
  const counts = await runMatching(db, study.id, today);

  // Spot-check: the expected status of each seeded case.
  const candidates = await db.select().from(studyCandidates);
  const byPatient = new Map(candidates.map((c) => [c.patientId, c.matchStatus]));
  let mismatches = 0;
  console.log("\nMatcher spot-check:");
  for (const p of PATIENTS.filter((x) => x.expect)) {
    const got = byPatient.get(pid[p.key]);
    const ok = got === p.expect;
    if (!ok) mismatches++;
    console.log(`  ${ok ? "✓" : "✗"} ${p.name.padEnd(18)} expected ${p.expect!.padEnd(14)} got ${got}`);
  }

  console.log(`\nSeeded ${STAFF.length} staff, ${PATIENTS.length} patients, ${visitRows.length} visits today, ${unreviewed.length} unreviewed results.`);
  console.log(`Study matching: ${counts.possible_match} possible match, ${counts.needs_check} needs check, ${counts.no_match} no match.`);
  console.log("\nStaff sign-in emails (magic link arrives in Mailpit at http://localhost:8025):");
  for (const s of STAFF) console.log(`  ${s.role.padEnd(13)} ${s.email}`);

  if (mismatches > 0) throw new Error(`${mismatches} seeded case(s) did not match the expected status`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
