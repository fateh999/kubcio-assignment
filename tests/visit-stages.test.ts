import { describe, expect, test } from "bun:test";
import { visitStage } from "../src/db/schema";
import { VISIT_STAGES, isAllowedTransition, isWaiting, nextStage, type VisitStage } from "../src/lib/visit-stages";

describe("visit stages (SPEC §7)", () => {
  test("matches the database enum, in order", () => {
    expect([...VISIT_STAGES]).toEqual([...visitStage.enumValues]);
  });

  test("each stage moves to exactly the next one; done is final", () => {
    expect(nextStage("scheduled")).toBe("checked_in");
    expect(nextStage("checked_in")).toBe("with_nurse");
    expect(nextStage("with_nurse")).toBe("ready_for_doctor");
    expect(nextStage("ready_for_doctor")).toBe("with_doctor");
    expect(nextStage("with_doctor")).toBe("ready_for_checkout");
    expect(nextStage("ready_for_checkout")).toBe("done");
    expect(nextStage("done")).toBeNull();
  });

  test("only single steps forward are allowed: no skipping, no going back, no staying put", () => {
    let allowed = 0;
    for (const from of VISIT_STAGES) {
      for (const to of VISIT_STAGES) {
        const i = VISIT_STAGES.indexOf(from);
        const j = VISIT_STAGES.indexOf(to);
        expect(isAllowedTransition(from, to)).toBe(j === i + 1);
        if (isAllowedTransition(from, to)) allowed++;
      }
    }
    expect(allowed).toBe(VISIT_STAGES.length - 1);
  });

  test("waiting time counts only while the patient is in the clinic", () => {
    const waiting = VISIT_STAGES.filter((s: VisitStage) => isWaiting(s));
    expect(waiting).toEqual(["checked_in", "with_nurse", "ready_for_doctor", "with_doctor", "ready_for_checkout"]);
  });
});
