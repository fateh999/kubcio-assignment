"use client";

import { useState } from "react";
import { approveCandidate, dismissCandidate, rerunMatching } from "@/actions/studies";
import { ActionMessage, useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Missing</TableHead>
            <TableHead>Review</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Consent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                No candidates. Try re-running matching.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id} data-testid={`candidate-${r.patientName}`} className="align-top">
              <TableCell className="font-medium">{r.patientName}</TableCell>
              <TableCell>
                <Badge variant={r.matchStatus === "possible_match" ? "default" : "secondary"}>{MATCH_LABEL[r.matchStatus]}</Badge>
              </TableCell>
              <TableCell className="max-w-80 whitespace-normal">
                <ul className="list-disc pl-4 text-xs">{r.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
              </TableCell>
              <TableCell className="whitespace-normal">
                <ul className="text-xs text-amber-700 dark:text-amber-400">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </TableCell>
              <TableCell className="whitespace-normal">
                {REVIEW_LABEL[r.reviewStatus]}
                {r.notes && <p className="text-xs text-muted-foreground">“{r.notes}”</p>}
              </TableCell>
              <TableCell>{CALL_LABEL[r.callStatus]}</TableCell>
              <TableCell>{CONSENT_LABEL[r.consentStatus]}</TableCell>
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
    </div>
  );
}
