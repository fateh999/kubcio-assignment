"use client";

import { useState } from "react";
import { approveCandidate, dismissCandidate, rerunMatching } from "@/actions/studies";
import { ActionMessage, useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { TableCard } from "@/components/ui-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CALL_LABEL, CONSENT_LABEL, MATCH_LABEL, REVIEW_LABEL } from "@/lib/format";

type Row = {
  id: string;
  patientName: string;
  matchStatus: keyof typeof MATCH_LABEL;
  evidence: string[];
  missing: string[];
  reviewStatus: keyof typeof REVIEW_LABEL;
  callStatus: keyof typeof CALL_LABEL;
  consentStatus: keyof typeof CONSENT_LABEL;
  notes: string | null;
};

function ReviewDialog({ row, kind }: { row: Row; kind: "approve" | "dismiss" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { run, pending, result } = useAction();
  const approve = kind === "approve";
  const title = approve ? "Approve for contact" : "Dismiss";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={approve ? "default" : "outline"} />}>{title}</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (approve ? approveCandidate(row.id, note) : dismissCandidate(row.id, note)), () => setOpen(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {title}: {row.patientName}
            </DialogTitle>
            <DialogDescription>
              {approve
                ? "Adds the patient to reception's call list. Consent stays unknown until reception records it after reaching them."
                : "Removes the patient from review. Nothing else changes."}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`note-${row.id}`}>Note (optional)</FieldLabel>
            <Textarea id={`note-${row.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ActionMessage result={result} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Evidence({ row }: { row: Row }) {
  return (
    <div className="mt-2 md:mt-0">
      <ul className="flex flex-col gap-0.5 text-sm">
        {row.evidence.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {row.missing.length > 0 && (
        <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">Missing: {row.missing.join(", ")}</p>
      )}
    </div>
  );
}

function Status({ row }: { row: Row }) {
  return (
    <div className="mt-3 md:mt-0">
      <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Review</dt>
        <dd>{REVIEW_LABEL[row.reviewStatus]}</dd>
        <dt className="text-muted-foreground">Call</dt>
        <dd>{CALL_LABEL[row.callStatus]}</dd>
        <dt className="text-muted-foreground">Consent</dt>
        <dd>{CONSENT_LABEL[row.consentStatus]}</dd>
      </dl>
      {row.notes && <p className="mt-2 text-xs text-muted-foreground">Note: “{row.notes}”</p>}
    </div>
  );
}

export function ReviewList({ rows }: { rows: Row[] }) {
  const rerun = useAction();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={rerun.pending} onClick={() => rerun.run(() => rerunMatching())}>
          {rerun.pending ? "Matching…" : "Re-run matching"}
        </Button>
        <ActionMessage result={rerun.result} />
      </div>
      {/* Phone/tablet: one card per candidate. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No candidates. Try re-running matching.</p>}
        {rows.map((r) => (
          <div key={r.id} data-testid={`candidate-card-${r.patientName}`} className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{r.patientName}</p>
              <Badge variant={r.matchStatus === "possible_match" ? "default" : "secondary"}>{MATCH_LABEL[r.matchStatus]}</Badge>
            </div>
            <Evidence row={r} />
            <Status row={r} />
            {r.reviewStatus === "pending" && (
              <div className="mt-3 flex gap-2">
                <ReviewDialog row={r} kind="approve" />
                <ReviewDialog row={r} kind="dismiss" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table. */}
      <TableCard className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Patient</TableHead>
              <TableHead>Evidence in the record</TableHead>
              <TableHead className="w-56">Status</TableHead>
              <TableHead className="w-60 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  No candidates. Try re-running matching.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`candidate-${r.patientName}`} className="align-top">
                <TableCell>
                  <p className="font-medium">{r.patientName}</p>
                  <Badge className="mt-1.5" variant={r.matchStatus === "possible_match" ? "default" : "secondary"}>
                    {MATCH_LABEL[r.matchStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Evidence row={r} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Status row={r} />
                </TableCell>
                <TableCell className="text-right">
                  {r.reviewStatus === "pending" && (
                    <div className="flex justify-end gap-2">
                      <ReviewDialog row={r} kind="approve" />
                      <ReviewDialog row={r} kind="dismiss" />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
