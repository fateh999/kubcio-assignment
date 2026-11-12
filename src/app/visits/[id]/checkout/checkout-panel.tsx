"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeVisit, toggleTask } from "@/actions/checkout";
import { updateContact } from "@/actions/visits";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/roles";
import type { VisitStage } from "@/lib/visit-stages";

type Props = {
  role: Role;
  visit: { id: string; stage: VisitStage; patientId: string; phone: string; email: string };
  tasks: { id: string; label: string; done: boolean }[];
};

export function CheckoutPanel({ role, visit, tasks }: Props) {
  const router = useRouter();
  const isReception = role === "receptionist";
  const [phone, setPhone] = useState(visit.phone);
  const [email, setEmail] = useState(visit.email);
  const contact = useAction();
  const taskAction = useAction();
  const complete = useAction();

  const open = tasks.filter((t) => !t.done).length;
  const tickable = visit.stage === "with_doctor" || visit.stage === "ready_for_checkout";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              contact.run(() => updateContact(visit.patientId, { phone, email }));
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isReception} />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isReception} />
              </Field>
            </div>
            <ActionMessage result={contact.result} />
            {isReception && (
              <div>
                <Button type="submit" variant="outline" size="sm" disabled={contact.pending}>
                  Save contact details
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Before the patient leaves</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checkout tasks.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={`task-${t.id}`}
                    checked={t.done}
                    disabled={!tickable || taskAction.pending}
                    onCheckedChange={(checked) => taskAction.run(() => toggleTask(t.id, checked === true))}
                  />
                  <label htmlFor={`task-${t.id}`} className={t.done ? "text-muted-foreground line-through" : ""}>
                    {t.label}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <ActionMessage result={taskAction.result} />

          {isReception && visit.stage === "ready_for_checkout" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={open > 0 || complete.pending}
                onClick={() => complete.run(() => completeVisit(visit.id), () => router.push("/board"))}
              >
                Complete visit
              </Button>
              {open > 0 && (
                <span className="text-sm text-muted-foreground" data-testid="open-hint">
                  {open} {open === 1 ? "task" : "tasks"} still open
                </span>
              )}
            </div>
          )}
          {visit.stage === "done" && <p className="text-sm text-muted-foreground">This visit is complete.</p>}
          <ActionMessage result={complete.result} />
        </CardContent>
      </Card>
    </>
  );
}
