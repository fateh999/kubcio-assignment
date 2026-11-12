/**
 * Visit stages (SPEC §7). Pure: no database access.
 *
 *   scheduled → checked_in → with_nurse → ready_for_doctor → with_doctor → ready_for_checkout → done
 *
 * A visit only ever moves one step forward. Nothing skips a stage or goes back.
 */

export const VISIT_STAGES = [
  "scheduled",
  "checked_in",
  "with_nurse",
  "ready_for_doctor",
  "with_doctor",
  "ready_for_checkout",
  "done",
] as const;

export type VisitStage = (typeof VISIT_STAGES)[number];

export const STAGE_LABEL: Record<VisitStage, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  with_nurse: "With nurse",
  ready_for_doctor: "Ready for doctor",
  with_doctor: "With doctor",
  ready_for_checkout: "Ready for checkout",
  done: "Done",
};

/** The one stage each stage may move to, or null for `done`. */
export function nextStage(stage: VisitStage): VisitStage | null {
  const i = VISIT_STAGES.indexOf(stage);
  return VISIT_STAGES[i + 1] ?? null;
}

/** True only for a single step forward. */
export function isAllowedTransition(from: VisitStage, to: VisitStage): boolean {
  return nextStage(from) === to;
}

/** Stages where the patient is in the clinic and waiting time counts (SPEC §10.1). */
export function isWaiting(stage: VisitStage): boolean {
  return stage !== "scheduled" && stage !== "done";
}
