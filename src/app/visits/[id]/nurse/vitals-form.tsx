"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveVitals, sendToDoctor } from "@/actions/visits";
import { ActionMessage, useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Vitals = { bpSys: string; bpDia: string; weightKg: string; tempC: string; nurseNote: string };

export function VitalsForm({ visitId, initial }: { visitId: string; initial: Vitals }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const { run, pending, result } = useAction();
  const set = (k: keyof Vitals) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vitals and note</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveVitals(visitId, v));
          }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="bpSys">Systolic (mmHg)</FieldLabel>
              <Input id="bpSys" inputMode="numeric" value={v.bpSys} onChange={set("bpSys")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bpDia">Diastolic (mmHg)</FieldLabel>
              <Input id="bpDia" inputMode="numeric" value={v.bpDia} onChange={set("bpDia")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
              <Input id="weightKg" inputMode="decimal" value={v.weightKg} onChange={set("weightKg")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="tempC">Temperature (°C)</FieldLabel>
              <Input id="tempC" inputMode="decimal" value={v.tempC} onChange={set("tempC")} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="nurseNote">Note for the doctor</FieldLabel>
            <Textarea id="nurseNote" rows={4} value={v.nurseNote} onChange={set("nurseNote")} />
          </Field>
          <ActionMessage result={result} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => sendToDoctor(visitId, v), () => router.push("/board"))}
            >
              Send to doctor
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
