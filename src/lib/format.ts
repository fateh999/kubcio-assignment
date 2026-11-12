/** Display helpers shared by the screens (SPEC §10). No eligibility language anywhere. */

export const MATCH_LABEL = { possible_match: "Possible match", needs_check: "Needs check", no_match: "No match" } as const;
export const REVIEW_LABEL = { pending: "Pending review", approved: "Approved for contact", dismissed: "Dismissed" } as const;
export const CALL_LABEL = { not_started: "Not started", needs_call: "Needs call", reached: "Reached", no_answer: "No answer" } as const;
export const CONSENT_LABEL = { unknown: "Unknown", consented: "Consented", declined: "Declined" } as const;

/** "Priya Shah" → "Priya"; "Dr Aisha Khan" → "Dr Khan" (board style, SPEC §10.1). */
export function shortName(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts[0] === "Dr" && parts.length > 1) return `Dr ${parts[parts.length - 1]}`;
  return parts[0];
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatTime = (d: Date | null | undefined) => (d ? timeFmt.format(d) : "—");
export const formatDate = (d: Date | string | null | undefined) => (d ? dateFmt.format(typeof d === "string" ? new Date(`${d}T00:00:00`) : d) : "—");

export function minutesSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
}
