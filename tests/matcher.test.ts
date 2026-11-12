import { describe, expect, test } from "bun:test";
import {
  MISSING_DIAGNOSIS,
  MISSING_DOB,
  ageOn,
  matchPatient,
  type MatcherPatient,
} from "../src/lib/matcher";

// Hand-written fixtures, never the database (SPEC §12).
const TODAY = "2026-11-12";

const patient = (p: Partial<MatcherPatient>): MatcherPatient => ({
  dob: "1980-01-01",
  conditions: [],
  medications: [],
  results: [],
  ...p,
});

const type2 = { name: "Type 2 diabetes", code: "E11.9", recordedAt: "2023-04-02" };
const type1 = { name: "Type 1 diabetes", code: "E10.9", recordedAt: "2020-06-15" };
const metformin = { name: "Metformin 500 mg", active: true };
const hba1c = { test: "HbA1c", value: "7.8", unit: "%", resultedAt: "2026-10-01T09:00:00.000Z" };

const fixtures = {
  adultType2: patient({ dob: "1972-03-01", conditions: [type2] }),
  adultMetforminNoDiagnosis: patient({ dob: "1965-05-20", medications: [metformin] }),
  diagnosisNoDob: patient({ dob: null, conditions: [type2] }),
  seventeenType1: patient({ dob: "2009-10-13", conditions: [type1] }),
  adultNoEvidence: patient({
    dob: "1986-07-07",
    conditions: [{ name: "Hypertension", code: "I10", recordedAt: "2021-01-01" }],
  }),
  turning18Today: patient({ dob: "2008-11-12", conditions: [type1] }),
  oneDayShortOf18: patient({ dob: "2008-11-13", conditions: [type1] }),
  codeOnlyDiagnosis: patient({ conditions: [{ name: "DM", code: "E11.65", recordedAt: "2022-02-02" }] }),
  hba1cOnly: patient({ results: [hba1c] }),
  signsNoDob: patient({ dob: null, medications: [{ name: "Insulin glargine", active: false }] }),
  adultType2WithSigns: patient({ dob: "1972-03-01", conditions: [type2], medications: [metformin], results: [hba1c] }),
};

const ALLOWED = ["possible_match", "needs_check", "no_match"];

describe("matchPatient: PRD edge cases", () => {
  test("1. adult with documented Type 2 diabetes → possible_match", () => {
    const r = matchPatient(fixtures.adultType2, TODAY);
    expect(r.status).toBe("possible_match");
    expect(r.evidence).toContain("Diagnosis: Type 2 diabetes (E11.9), recorded 2023-04-02");
    expect(r.evidence).toContain("Age 54");
    expect(r.missing).toEqual([]);
  });

  test("2. adult on metformin, no diagnosis → needs_check", () => {
    const r = matchPatient(fixtures.adultMetforminNoDiagnosis, TODAY);
    expect(r.status).toBe("needs_check");
    expect(r.missing).toContain(MISSING_DIAGNOSIS);
    expect(r.evidence).toContain("Medication: Metformin 500 mg (active)");
  });

  test("3. diabetes diagnosis, no date of birth → needs_check", () => {
    const r = matchPatient(fixtures.diagnosisNoDob, TODAY);
    expect(r.status).toBe("needs_check");
    expect(r.missing).toContain(MISSING_DOB);
    expect(r.evidence).toContain("Diagnosis: Type 2 diabetes (E11.9), recorded 2023-04-02");
  });

  test("4. 17-year-old with Type 1 diabetes → no_match", () => {
    expect(matchPatient(fixtures.seventeenType1, TODAY).status).toBe("no_match");
  });

  test("5. adult with no diabetes evidence → no_match", () => {
    const r = matchPatient(fixtures.adultNoEvidence, TODAY);
    expect(r.status).toBe("no_match");
    expect(r.evidence).toEqual([]);
  });

  test("6. turning 18 today, with diagnosis → possible_match; one day younger → no_match", () => {
    const r = matchPatient(fixtures.turning18Today, TODAY);
    expect(r.status).toBe("possible_match");
    expect(r.evidence).toContain("Age 18");
    expect(matchPatient(fixtures.oneDayShortOf18, TODAY).status).toBe("no_match");
  });
});

describe("matchPatient: rules", () => {
  test("7. missing information never gives possible_match", () => {
    const withMissing = [
      fixtures.diagnosisNoDob,
      fixtures.signsNoDob,
      fixtures.adultMetforminNoDiagnosis,
      fixtures.hba1cOnly,
    ];
    for (const p of withMissing) {
      const r = matchPatient(p, TODAY);
      expect(r.status).not.toBe("possible_match");
      expect(r.status).toBe("needs_check");
      expect(r.missing.length).toBeGreaterThan(0);
    }
    const r = matchPatient(fixtures.signsNoDob, TODAY);
    expect(r.missing).toEqual([MISSING_DIAGNOSIS, MISSING_DOB]);
  });

  test("8. no eligibility language, and status is always one of the three values", () => {
    for (const p of Object.values(fixtures)) {
      const r = matchPatient(p, TODAY);
      expect(ALLOWED).toContain(r.status);
      expect(JSON.stringify(r)).not.toMatch(/eligib/i);
    }
  });

  test("9. a code-only diagnosis (E11.65) counts as documented", () => {
    expect(matchPatient(fixtures.codeOnlyDiagnosis, TODAY).status).toBe("possible_match");
  });

  test("10. HbA1c alone → needs_check, shown as context only", () => {
    const r = matchPatient(fixtures.hba1cOnly, TODAY);
    expect(r.status).toBe("needs_check");
    expect(r.evidence).toContain("Result: HbA1c 7.8 % on 2026-10-01 (context only, no threshold applied)");
  });

  test("signs are listed alongside a diagnosis, and lab values never change the status", () => {
    const r = matchPatient(fixtures.adultType2WithSigns, TODAY);
    expect(r.status).toBe("possible_match");
    expect(r.evidence).toHaveLength(4);
    const lowA1c = patient({ ...fixtures.adultType2WithSigns, results: [{ ...hba1c, value: "5.1" }] });
    expect(matchPatient(lowA1c, TODAY).status).toBe("possible_match");
  });
});

describe("ageOn", () => {
  test("counts whole years on calendar dates", () => {
    expect(ageOn("2008-11-12", "2026-11-12")).toBe(18);
    expect(ageOn("2008-11-13", "2026-11-12")).toBe(17);
    expect(ageOn("2008-12-01", "2026-11-12")).toBe(17);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2000-02-29", "2026-03-01")).toBe(26);
  });
});
