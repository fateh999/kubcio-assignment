import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localISODate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { ageOn } from "@/lib/matcher";
import { requireUser } from "@/lib/require-user";
import { STAGE_LABEL } from "@/lib/visit-stages";
import { getDoctorVisit } from "@/server/queries";
import { DoctorWork, MarkReviewedButton } from "./doctor-work";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

const Section = ({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) => (
  <Card data-testid={testId}>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-sm">{children}</CardContent>
  </Card>
);

// Doctor step (FR3 · SPEC §10.3). Order is fixed: handoff first, then context, then the doctor's work.
export default async function DoctorVisitPage({ params }: PageProps<"/visits/[id]/doctor">) {
  const me = await requireUser(["doctor"]);
  const { id } = await params;
  const data = await getDoctorVisit(id);
  if (!data) notFound();
  const { visit: v } = data;
  const editable = v.stage === "with_doctor" && v.doctorId === me.id;
  const age = v.dob ? `Age ${ageOn(v.dob, localISODate())}` : "Age unknown";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <Link href="/board" className="text-sm underline underline-offset-4">
        ← Visit board
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{v.patientName}</h1>
        <span className="text-muted-foreground">{age}</span>
        {v.urgent && <Badge variant="destructive">Urgent</Badge>}
        <Badge variant="secondary">{STAGE_LABEL[v.stage]}</Badge>
      </div>
      {!editable && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {v.stage === "ready_for_doctor"
            ? "Take this patient from the visit board to write notes and add checkout tasks."
            : v.stage === "with_doctor"
              ? `This patient is with ${v.doctorName ?? "another doctor"}. Read-only.`
              : "Read-only."}
        </p>
      )}

      {/* 1–3: the handoff, above everything else */}
      <Card data-testid="handoff" className="border-primary/40">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason for visit</p>
            <p className="text-lg">{v.reason}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nurse vitals{v.nurseName ? ` · ${v.nurseName}` : ""}</p>
            <p>BP {v.bpSys ?? "—"}/{v.bpDia ?? "—"} mmHg</p>
            <p>Weight {v.weightKg ?? "—"} kg</p>
            <p>Temp {v.tempC ?? "—"} °C</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nurse note</p>
            <p className="whitespace-pre-wrap">{v.nurseNote || "No note."}</p>
          </div>
        </CardContent>
      </Card>

      {/* 4–7: context */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Section title="Diagnoses" testId="diagnoses">
          {data.conditions.length === 0 ? (
            <p className="text-muted-foreground">None recorded</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.conditions.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.code && <span className="text-muted-foreground"> ({c.code})</span>}
                  <span className="text-muted-foreground"> · {formatDate(c.recordedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Active medications" testId="medications">
          {data.medications.length === 0 ? (
            <p className="text-muted-foreground">None</p>
          ) : (
            <ul className="flex flex-col gap-1">{data.medications.map((m) => <li key={m.id}>{m.name}</li>)}</ul>
          )}
        </Section>
        <Section title="Allergies" testId="allergies">
          {data.allergies.length === 0 ? (
            <p className="text-muted-foreground">No known allergies recorded</p>
          ) : (
            <ul className="flex flex-col gap-1">{data.allergies.map((a) => <li key={a.id}>{a.substance}</li>)}</ul>
          )}
        </Section>
      </div>

      <Section title="Recent results" testId="results">
        {data.results.length === 0 ? (
          <p className="text-muted-foreground">No results</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.results.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 ${r.reviewedAt ? "" : "bg-amber-100 dark:bg-amber-900/30"}`}
              >
                <span className="font-medium">{r.test}</span>
                <span>
                  {r.value}
                  {r.unit ? ` ${r.unit}` : ""}
                </span>
                <span className="text-muted-foreground">· {formatDate(r.resultedAt)}</span>
                {!r.reviewedAt && (
                  <>
                    <Badge variant="outline">Unreviewed</Badge>
                    <MarkReviewedButton resultId={r.id} label={`Mark ${r.test} reviewed`} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 8–10: the doctor's work */}
      <DoctorWork
        visitId={v.id}
        editable={editable}
        initialNote={v.doctorNote ?? ""}
        tasks={data.tasks.map((t) => ({ id: t.id, label: t.label, done: t.done }))}
      />
    </main>
  );
}
