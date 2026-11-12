/**
 * Study actions (SPEC §8.4).
 *
 * reviewStatus, callStatus and consentStatus are independent. Each action changes only its own
 * fields. The one coupling: approval moves callStatus from not_started to needs_call.
 * Nothing here sets consentStatus except recordConsent.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { studies, studyCandidates } from "@/db/schema";
import { localISODate } from "@/lib/dates";
import { runMatching } from "@/lib/run-matching";

/** The one seeded study (SPEC §11). */
export const DIABETES_STUDY_NAME = "Diabetes study";
import { type ActionResult, type Actor, type Db, NOT_ALLOWED, fail, idSchema, isAllowed, ok, optionalText, parse } from "./common";

const noteSchema = optionalText(1000, "Note");

export async function rerunMatching(db: Db, actor: Actor): Promise<ActionResult> {
  if (!isAllowed(actor, "rerunMatching")) return fail(NOT_ALLOWED);
  const [study] = await db.select({ id: studies.id }).from(studies).where(eq(studies.name, DIABETES_STUDY_NAME)).limit(1);
  if (!study) return fail("No study is set up");
  const counts = await runMatching(db as Parameters<typeof runMatching>[0], study.id, localISODate());
  const listed = counts.possible_match + counts.needs_check;
  return ok(
    `Matched ${listed} ${listed === 1 ? "patient" : "patients"}: ${counts.possible_match} possible match, ${counts.needs_check} needs check`,
  );
}

/** Only pending candidates that are listed (possible_match / needs_check) can be reviewed. */
const reviewable = (id: string) =>
  and(eq(studyCandidates.id, id), eq(studyCandidates.reviewStatus, "pending"), ne(studyCandidates.matchStatus, "no_match"));

export async function approveCandidate(db: Db, actor: Actor, candidateId: unknown, note?: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "approveCandidate")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, candidateId);
  if ("error" in id) return fail(id.error);
  const text = parse(noteSchema, note);
  if ("error" in text) return fail(text.error);
  const updated = await db
    .update(studyCandidates)
    .set({
      reviewStatus: "approved",
      reviewedBy: actor.id,
      // Approval queues the call, but never moves a call that has already started.
      callStatus: sql`case when ${studyCandidates.callStatus} = 'not_started' then 'needs_call'::call_status else ${studyCandidates.callStatus} end`,
      ...(text.data !== undefined ? { notes: text.data } : {}),
      updatedAt: new Date(),
    })
    .where(reviewable(id.data))
    .returning({ id: studyCandidates.id });
  return updated.length === 1 ? ok("Approved for contact. Added to the call list") : fail("This candidate was already reviewed");
}

export async function dismissCandidate(db: Db, actor: Actor, candidateId: unknown, note?: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "dismissCandidate")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, candidateId);
  if ("error" in id) return fail(id.error);
  const text = parse(noteSchema, note);
  if ("error" in text) return fail(text.error);
  const updated = await db
    .update(studyCandidates)
    .set({
      reviewStatus: "dismissed",
      reviewedBy: actor.id,
      ...(text.data !== undefined ? { notes: text.data } : {}),
      updatedAt: new Date(),
    })
    .where(reviewable(id.data))
    .returning({ id: studyCandidates.id });
  return updated.length === 1 ? ok("Dismissed") : fail("This candidate was already reviewed");
}

export async function logCall(db: Db, actor: Actor, candidateId: unknown, outcome: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "logCall")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, candidateId);
  if ("error" in id) return fail(id.error);
  const result = parse(z.enum(["reached", "no_answer"], { error: "Choose reached or no answer" }), outcome);
  if ("error" in result) return fail(result.error);
  const updated = await db
    .update(studyCandidates)
    .set({ callStatus: result.data, updatedAt: new Date() })
    .where(
      and(
        eq(studyCandidates.id, id.data),
        eq(studyCandidates.reviewStatus, "approved"),
        inArray(studyCandidates.callStatus, ["needs_call", "no_answer"]),
      ),
    )
    .returning({ id: studyCandidates.id });
  if (updated.length === 0) return fail("This patient isn't on the call list");
  return ok(result.data === "reached" ? "Logged: reached. Record consent next" : "Logged: no answer");
}

/** Only after the patient is reached, and only once. */
export async function recordConsent(db: Db, actor: Actor, candidateId: unknown, value: unknown): Promise<ActionResult> {
  if (!isAllowed(actor, "recordConsent")) return fail(NOT_ALLOWED);
  const id = parse(idSchema, candidateId);
  if ("error" in id) return fail(id.error);
  const consent = parse(z.enum(["consented", "declined"], { error: "Choose consented or declined" }), value);
  if ("error" in consent) return fail(consent.error);
  const updated = await db
    .update(studyCandidates)
    .set({ consentStatus: consent.data, consentBy: actor.id, updatedAt: new Date() })
    .where(
      and(
        eq(studyCandidates.id, id.data),
        eq(studyCandidates.callStatus, "reached"),
        eq(studyCandidates.consentStatus, "unknown"),
      ),
    )
    .returning({ id: studyCandidates.id });
  if (updated.length === 0) return fail("Consent can only be recorded once, after the patient has been reached");
  return ok(consent.data === "consented" ? "Recorded: consented" : "Recorded: declined");
}
