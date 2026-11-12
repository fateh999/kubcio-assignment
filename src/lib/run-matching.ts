import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { studyCandidates } from "@/db/schema";
import { localISODate } from "@/lib/dates";
import { matchPatient, type MatchStatus } from "@/lib/matcher";

/**
 * Runs the matcher for every patient and upserts one studyCandidates row each (SPEC §8.4, §9).
 *
 * On re-run only matchStatus, evidenceJson, missingJson and updatedAt change.
 * reviewStatus, reviewedBy, callStatus, consentStatus, consentBy and notes are never touched.
 * no_match rows are kept (so an earlier review isn't lost) but are never listed.
 */
export async function runMatching(db: DB, studyId: string, today: string) {
  const patients = await db.query.patients.findMany({
    with: { conditions: true, medications: true, results: true },
  });

  const counts: Record<MatchStatus, number> = { possible_match: 0, needs_check: 0, no_match: 0 };
  if (patients.length === 0) return counts;

  const rows = patients.map((p) => {
    const r = matchPatient(
      {
        dob: p.dob,
        conditions: p.conditions.map((c) => ({ name: c.name, code: c.code, recordedAt: c.recordedAt })),
        medications: p.medications.map((m) => ({ name: m.name, active: m.active })),
        results: p.results.map((x) => ({
          test: x.test,
          value: x.value,
          unit: x.unit,
          resultedAt: localISODate(x.resultedAt),
        })),
      },
      today,
    );
    counts[r.status]++;
    return {
      studyId,
      patientId: p.id,
      matchStatus: r.status,
      evidenceJson: r.evidence,
      missingJson: r.missing,
      updatedAt: new Date(),
    };
  });

  await db
    .insert(studyCandidates)
    .values(rows)
    .onConflictDoUpdate({
      target: [studyCandidates.studyId, studyCandidates.patientId],
      set: {
        matchStatus: sql`excluded.match_status`,
        evidenceJson: sql`excluded.evidence_json`,
        missingJson: sql`excluded.missing_json`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  return counts;
}
