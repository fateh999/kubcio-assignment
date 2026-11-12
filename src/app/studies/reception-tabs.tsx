"use client";

import { logCall, recordConsent } from "@/actions/studies";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CALL_LABEL, CONSENT_LABEL, formatDate, formatTime } from "@/lib/format";

type CallRow = { id: string; patientName: string; phone: string; callStatus: keyof typeof CALL_LABEL; updatedAt: Date };
type ConsentRow = { id: string; patientName: string; phone: string; consentStatus: keyof typeof CONSENT_LABEL; consentByName: string | null };

function CallButtons({ id, name }: { id: string; name: string }) {
  const { run, pending, result } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button size="sm" aria-label={`Reached ${name}`} disabled={pending} onClick={() => run(() => logCall(id, "reached"))}>
          Reached
        </Button>
        <Button size="sm" variant="outline" aria-label={`No answer from ${name}`} disabled={pending} onClick={() => run(() => logCall(id, "no_answer"))}>
          No answer
        </Button>
      </div>
      {result && "error" in result && <ActionMessage result={result} />}
    </div>
  );
}

function ConsentButtons({ id, name }: { id: string; name: string }) {
  const { run, pending, result } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button size="sm" aria-label={`${name} consented`} disabled={pending} onClick={() => run(() => recordConsent(id, "consented"))}>
          Consented
        </Button>
        <Button size="sm" variant="outline" aria-label={`${name} declined`} disabled={pending} onClick={() => run(() => recordConsent(id, "declined"))}>
          Declined
        </Button>
      </div>
      {result && "error" in result && <ActionMessage result={result} />}
    </div>
  );
}

export function ReceptionStudyTabs({ callList, consentList }: { callList: CallRow[]; consentList: ConsentRow[] }) {
  return (
    <Tabs defaultValue="calls">
      <TabsList>
        <TabsTrigger value="calls">Call list ({callList.length})</TabsTrigger>
        <TabsTrigger value="consent">Consent ({consentList.filter((c) => c.consentStatus === "unknown").length} to record)</TabsTrigger>
      </TabsList>

      <TabsContent value="calls" className="pt-4">
        <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Call status</TableHead>
              <TableHead className="hidden sm:table-cell">Last updated</TableHead>
              <TableHead className="text-right">Log call</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No one to call.
                </TableCell>
              </TableRow>
            )}
            {callList.map((c) => (
              <TableRow key={c.id} data-testid={`call-${c.patientName}`}>
                <TableCell className="font-medium">{c.patientName}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{CALL_LABEL[c.callStatus]}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDate(c.updatedAt)} {formatTime(c.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <CallButtons id={c.id} name={c.patientName} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableCard>
      </TabsContent>

      <TabsContent value="consent" className="pt-4">
        <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead className="text-right">Record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consentList.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No patients reached yet.
                </TableCell>
              </TableRow>
            )}
            {consentList.map((c) => (
              <TableRow key={c.id} data-testid={`consent-${c.patientName}`}>
                <TableCell className="font-medium">{c.patientName}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>
                  {CONSENT_LABEL[c.consentStatus]}
                  {c.consentByName && <span className="text-xs text-muted-foreground"> · recorded by {c.consentByName}</span>}
                </TableCell>
                <TableCell className="text-right">{c.consentStatus === "unknown" && <ConsentButtons id={c.id} name={c.patientName} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableCard>
      </TabsContent>
    </Tabs>
  );
}
