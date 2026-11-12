import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldCaption, PageHeader, StageBadge, UrgentBadge } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localISODate } from "@/lib/dates";
import { ageOn } from "@/lib/matcher";
import { requireUser } from "@/lib/require-user";
import { getNurseVisit } from "@/server/queries";
import { VitalsForm } from "./vitals-form";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Nurse step (FR2 · SPEC §10.2).
export default async function NurseVisitPage({ params }: PageProps<"/visits/[id]/nurse">) {
  const me = await requireUser(["nurse"]);
  const { id } = await params;
  const v = await getNurseVisit(id);
  if (!v) notFound();

  const editable = v.stage === "with_nurse" && v.nurseId === me.id;
  const age = v.dob ? `Age ${ageOn(v.dob, localISODate())}` : "Age unknown";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <Link href="/board" className="text-sm text-muted-foreground hover:text-foreground">
        ← Visit board
      </Link>
      <PageHeader
        title={
          <>
            {v.patientName} {v.urgent && <UrgentBadge />} <StageBadge stage={v.stage} />
          </>
        }
        description={age}
      />

      <Card>
        <CardContent className="flex flex-col gap-1">
          <FieldCaption>Reason for visit</FieldCaption>
          <p className="text-lg font-medium" data-testid="reason">
            {v.reason}
          </p>
        </CardContent>
      </Card>

      {editable ? (
        <VitalsForm
          visitId={v.id}
          initial={{
            bpSys: v.bpSys?.toString() ?? "",
            bpDia: v.bpDia?.toString() ?? "",
            weightKg: v.weightKg ?? "",
            tempC: v.tempC ?? "",
            nurseNote: v.nurseNote ?? "",
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vitals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p role="status" className="text-muted-foreground">
              {v.stage === "with_nurse"
                ? `This patient is with ${v.nurseName ?? "another nurse"}. Read-only.`
                : v.stage === "checked_in"
                  ? "Take this patient from the visit board to record vitals."
                  : "This patient has moved on. Read-only."}
            </p>
            <p>
              BP {v.bpSys ?? "—"}/{v.bpDia ?? "—"} · Weight {v.weightKg ?? "—"} kg · Temp {v.tempC ?? "—"} °C
            </p>
            {v.nurseNote && <p className="whitespace-pre-wrap">{v.nurseNote}</p>}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
