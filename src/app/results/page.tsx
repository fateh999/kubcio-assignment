import Link from "next/link";
import { PageHeader, TableCard } from "@/components/ui-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/require-user";
import { getUnreviewedResults } from "@/server/queries";
import { MarkReviewedButton } from "../visits/[id]/doctor/doctor-work";

// Per-user, session-gated page: render on the server before sending (no instant shell).
export const instant = false;

// Results to review (FR4 · SPEC §10.4). Nurse and doctor can see it; only a doctor marks reviewed.
export default async function ResultsPage() {
  const me = await requireUser(["nurse", "doctor"]);
  const rows = await getUnreviewedResults(new Date());
  const isDoctor = me.role === "doctor";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageHeader
        title="Results to review"
        description={`${rows.length} unreviewed, oldest first.${isDoctor ? "" : " Only a doctor can mark a result reviewed."}`}
      />
      <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Test</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="hidden sm:table-cell">Resulted</TableHead>
            {isDoctor && <TableHead className="text-right">Review</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Nothing waiting for review.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id} data-testid={`result-${r.patientName}-${r.test}`}>
              <TableCell className="font-medium">
                {isDoctor && r.todayVisitId ? (
                  <Link href={`/visits/${r.todayVisitId}/doctor`} className="underline underline-offset-4">
                    {r.patientName}
                  </Link>
                ) : (
                  r.patientName
                )}
              </TableCell>
              <TableCell>
                {r.test}
                <span className="block text-xs text-muted-foreground sm:hidden">{formatDate(r.resultedAt)}</span>
              </TableCell>
              <TableCell className="tabular-nums font-medium">
                {r.value}
                {r.unit ? ` ${r.unit}` : ""}
              </TableCell>
              <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{formatDate(r.resultedAt)}</TableCell>
              {isDoctor && (
                <TableCell className="text-right">
                  <MarkReviewedButton resultId={r.id} label={`Mark ${r.patientName} ${r.test} reviewed`} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableCard>
    </main>
  );
}
