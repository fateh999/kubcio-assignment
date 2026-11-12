"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleTask } from "@/actions/checkout";
import { markReviewed } from "@/actions/results";
import { addCheckoutTask, saveDoctorNote, sendToCheckout } from "@/actions/visits";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MarkReviewedButton({ resultId, label }: { resultId: string; label: string }) {
  const { run, pending, result } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" aria-label={label} disabled={pending} onClick={() => run(() => markReviewed(resultId))}>
        Mark reviewed
      </Button>
      {result && "error" in result && <ActionMessage result={result} />}
    </>
  );
}

type Task = { id: string; label: string; done: boolean };

export function DoctorWork({ visitId, editable, initialNote, tasks }: { visitId: string; editable: boolean; initialNote: string; tasks: Task[] }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [label, setLabel] = useState("");
  const noteAction = useAction();
  const taskAction = useAction();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visit note and checkout tasks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            noteAction.run(() => saveDoctorNote(visitId, note));
          }}
        >
          <Field>
            <FieldLabel htmlFor="doctorNote">Visit note</FieldLabel>
            <Textarea id="doctorNote" rows={5} value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} />
          </Field>
          {editable && (
            <div>
              <Button type="submit" variant="outline" size="sm" disabled={noteAction.pending}>
                Save note
              </Button>
            </div>
          )}
        </form>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Checkout tasks</p>
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`task-${t.id}`}
                  checked={t.done}
                  disabled={!editable || taskAction.pending}
                  onCheckedChange={(checked) => taskAction.run(() => toggleTask(t.id, checked === true))}
                />
                <label htmlFor={`task-${t.id}`} className={t.done ? "text-muted-foreground line-through" : ""}>
                  {t.label}
                </label>
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                taskAction.run(() => addCheckoutTask(visitId, label), () => {
                  setLabel("");
                  router.refresh();
                });
              }}
            >
              <Input
                aria-label="New checkout task"
                placeholder="e.g. Book follow-up in 3 months"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="max-w-sm"
              />
              <Button type="submit" variant="outline" disabled={taskAction.pending || label.trim() === ""}>
                Add task
              </Button>
            </form>
          )}
          <ActionMessage result={taskAction.result} />
        </div>

        <ActionMessage result={noteAction.result} />
        {editable && (
          <div>
            <Button disabled={noteAction.pending} onClick={() => noteAction.run(() => sendToCheckout(visitId, note), () => router.push("/board"))}>
              Send to checkout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
