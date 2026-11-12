"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkIn, doctorTake, nurseTake, setUrgent } from "@/actions/visits";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Role } from "@/lib/roles";
import type { VisitStage } from "@/lib/visit-stages";

type Props = { role: Role; visit: { id: string; stage: VisitStage; urgent: boolean; mine: boolean } };

/** Row buttons by role (SPEC §10.1). The server re-checks every one of them (SPEC §8). */
export function BoardRowActions({ role, visit }: Props) {
  const router = useRouter();
  const { run, pending, result } = useAction();
  const link = buttonVariants({ variant: "outline", size: "sm" });

  const buttons: React.ReactNode[] = [];
  if (role === "receptionist") {
    if (visit.stage === "scheduled")
      buttons.push(
        <Button key="in" size="sm" disabled={pending} onClick={() => run(() => checkIn(visit.id))}>
          Check in
        </Button>,
      );
    if (visit.stage !== "done")
      buttons.push(
        <Button key="urgent" size="sm" variant="outline" disabled={pending} onClick={() => run(() => setUrgent(visit.id, !visit.urgent))}>
          {visit.urgent ? "Unmark urgent" : "Mark urgent"}
        </Button>,
      );
    if (visit.stage === "ready_for_checkout")
      buttons.push(
        <Link key="co" href={`/visits/${visit.id}/checkout`} className={link}>
          Checkout
        </Link>,
      );
  }
  if (role === "nurse") {
    if (visit.stage === "checked_in")
      buttons.push(
        <Button key="take" size="sm" disabled={pending} onClick={() => run(() => nurseTake(visit.id), () => router.push(`/visits/${visit.id}/nurse`))}>
          Take patient
        </Button>,
      );
    if (visit.stage === "with_nurse" && visit.mine)
      buttons.push(
        <Link key="cont" href={`/visits/${visit.id}/nurse`} className={link}>
          Continue
        </Link>,
      );
  }
  if (role === "doctor") {
    if (visit.stage === "ready_for_doctor")
      buttons.push(
        <Button key="take" size="sm" disabled={pending} onClick={() => run(() => doctorTake(visit.id), () => router.push(`/visits/${visit.id}/doctor`))}>
          Take patient
        </Button>,
      );
    if (visit.stage === "with_doctor" && visit.mine)
      buttons.push(
        <Link key="cont" href={`/visits/${visit.id}/doctor`} className={link}>
          Continue
        </Link>,
      );
  }

  if (buttons.length === 0 && !result) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">{buttons}</div>
      {result && "error" in result && <ActionMessage result={result} />}
    </div>
  );
}
