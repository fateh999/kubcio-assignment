/**
 * Diabetes study matcher (SPEC §9).
 *
 * Points staff to evidence in the record; it never decides anything about the patient.
 * Pure: no database, network or clock access. `today` is passed in.
 *
 * Criteria (clinic owner): adult AND a documented diagnosis of diabetes.
 * No lab thresholds, recency rules or medication exclusions: none were confirmed.
 */

export type MatchStatus = "possible_match" | "needs_check" | "no_match";

export interface MatcherPatient {
  dob: string | null; // "YYYY-MM-DD"
  conditions: { name: string; code: string | null; recordedAt: string }[];
  medications: { name: string; active: boolean }[];
  results: { test: string; value: string; unit: string | null; resultedAt: string }[];
}

export interface MatchResult {
  status: MatchStatus;
  evidence: string[];
  missing: string[];
}

export const MISSING_DOB = "Date of birth";
export const MISSING_DIAGNOSIS = "No documented diagnosis";

const DIABETES_CODE = /^E1[0-4]/;
const DIABETES_MED = /metformin|insulin/i;
const HBA1C_TEST = /hba1c|a1c/i;

/** A documented diagnosis = condition name contains "diabetes" or code starts with E10–E14. */
export function isDiabetesDiagnosis(c: { name: string; code: string | null }): boolean {
  return /diabetes/i.test(c.name) || (c.code !== null && DIABETES_CODE.test(c.code.trim().toUpperCase()));
}

/** Whole years between two calendar dates ("YYYY-MM-DD"). Someone born on today's date N years ago is N. */
export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}

const dateOnly = (iso: string) => iso.slice(0, 10);

export function matchPatient(patient: MatcherPatient, today: string): MatchResult {
  const age = patient.dob ? ageOn(patient.dob, today) : null;

  const diagnoses = patient.conditions
    .filter(isDiabetesDiagnosis)
    .map((c) => `Diagnosis: ${c.name}${c.code ? ` (${c.code})` : ""}, recorded ${dateOnly(c.recordedAt)}`);

  const signs = [
    ...patient.medications
      .filter((m) => DIABETES_MED.test(m.name))
      .map((m) => `Medication: ${m.name} (${m.active ? "active" : "inactive"})`),
    ...patient.results
      .filter((r) => HBA1C_TEST.test(r.test))
      .map(
        (r) =>
          `Result: ${r.test} ${r.value}${r.unit ? ` ${r.unit}` : ""} on ${dateOnly(r.resultedAt)} (context only, no threshold applied)`,
      ),
  ];

  const ageLine = age !== null ? [`Age ${age}`] : [];

  // 1. Known to be under 18: not listed, whatever else is in the record.
  if (age !== null && age < 18) {
    return { status: "no_match", evidence: ageLine, missing: [] };
  }

  if (diagnoses.length > 0) {
    // 2. Adult with a documented diagnosis.
    if (age !== null) {
      return { status: "possible_match", evidence: [...diagnoses, ...ageLine, ...signs], missing: [] };
    }
    // 3. Diagnosis but no date of birth: missing data is never a possible match.
    return { status: "needs_check", evidence: [...diagnoses, ...signs], missing: [MISSING_DOB] };
  }

  // 4. Signs without a documented diagnosis.
  if (signs.length > 0) {
    return {
      status: "needs_check",
      evidence: [...signs, ...ageLine],
      missing: [MISSING_DIAGNOSIS, ...(age === null ? [MISSING_DOB] : [])],
    };
  }

  // 5. No diabetes evidence at all.
  return { status: "no_match", evidence: [], missing: [] };
}
