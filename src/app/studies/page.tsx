import { PageHeader } from "@/components/ui-kit";
import { requireUser } from "@/lib/require-user";
import { getCallList, getConsentList, getStudyReviewList } from "@/server/queries";
import { ReceptionStudyTabs } from "./reception-tabs";
import { ReviewList } from "./review-list";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Diabetes study (FR6 · SPEC §10.6). Doctors review; reception calls and records consent.
// Reception's queries never load evidence or missing items (they contain diagnoses).
export default async function StudiesPage() {
  const me = await requireUser(["doctor", "receptionist"]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader title="Diabetes study" description="Criteria from the clinic: adult and a documented diagnosis of diabetes." />
      {me.role === "doctor" ? (
        <ReviewList rows={await getStudyReviewList()} />
      ) : (
        <ReceptionStudyTabs callList={await getCallList()} consentList={await getConsentList()} />
      )}
      <p className="mt-6 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        A possible match only means the record suggests this patient may suit the study. It is not a decision and not consent.
      </p>
    </main>
  );
}
