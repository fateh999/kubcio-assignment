/**
 * Every "use server" action calls requireUser() with exactly the roles SPEC §8 lists, before any
 * logic or database access. requireUser is mocked to record the roles and stop.
 *   bun run test:db
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls: string[][] = [];
const STOP = "requireUser refused (test)";
mock.module("@/lib/require-user", () => ({
  requireUser: async (roles?: string[]) => {
    calls.push([...(roles ?? [])].sort());
    throw new Error(STOP);
  },
}));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));

// Copied by hand from SPEC §8 tables, deliberately not imported from the code.
const SPEC_ROLES: Record<string, string[]> = {
  checkIn: ["receptionist"],
  setUrgent: ["receptionist"],
  updateContact: ["receptionist"],
  nurseTake: ["nurse"],
  saveVitals: ["nurse"],
  sendToDoctor: ["nurse"],
  doctorTake: ["doctor"],
  saveDoctorNote: ["doctor"],
  addCheckoutTask: ["doctor"],
  sendToCheckout: ["doctor"],
  markReviewed: ["doctor"],
  toggleTask: ["doctor", "receptionist"],
  completeVisit: ["receptionist"],
  rerunMatching: ["doctor"],
  approveCandidate: ["doctor"],
  dismissCandidate: ["doctor"],
  logCall: ["receptionist"],
  recordConsent: ["receptionist"],
};

const modules = {
  visits: await import("../src/actions/visits"),
  results: await import("../src/actions/results"),
  checkout: await import("../src/actions/checkout"),
  studies: await import("../src/actions/studies"),
};
const exported = Object.entries(modules).flatMap(([area, m]) =>
  Object.entries(m).map(([name, fn]) => ({ area, name, fn: fn as (...args: unknown[]) => Promise<unknown> })),
);

beforeEach(() => {
  calls.length = 0;
});

describe("server action guards (SPEC §6, §8)", () => {
  test("exactly the §8.1–§8.4 actions are exported, nothing extra", () => {
    expect(exported.map((e) => e.name).sort()).toEqual(Object.keys(SPEC_ROLES).sort());
  });

  for (const name of Object.keys(SPEC_ROLES)) {
    test(`${name} requires ${SPEC_ROLES[name].join(" or ")}, before anything else`, async () => {
      const action = exported.find((e) => e.name === name)!;
      // Bogus arguments: if the guard didn't run first, these would hit validation or the DB instead.
      await expect(action.fn("guard-test-id", true, "x")).rejects.toThrow(STOP);
      expect(calls).toEqual([SPEC_ROLES[name]]);
    });
  }
});
